import type { ChannelContent, PhotoRef, PipelineStage, Platform, ProjectContext, StageStatus } from "@postory/shared";
import { api, ApiError } from "./api";
import { now, uid } from "./db";
import { blobToDataUrl, formatTakenDate, isoDay } from "./images";
import {
  addVersion,
  getProject,
  listContents,
  listEvidence,
  listImages,
  logEvent,
  logUsage,
  replaceEvidence,
  replaceIssues,
  replaceQuestions,
  updateEvidence,
  updateImage,
  updateProject,
  updateQuestion,
  upsertContent,
  getVersion,
  getContent,
  listQuestions,
  updateVersionData,
} from "./repo";
import { loadPersonalization, markMemoryUsed } from "./profiles";
import type { ContentRecord, EvidenceRecord, ImageRecord, IssueRecord, ProjectRecord, QuestionRecord } from "./types";

// 생성 파이프라인 (계획서 3.3) — 브라우저가 단계를 순서대로 호출하고, 단계마다 결과를 IndexedDB에 저장한다.
// 실패하면 그 단계부터 다시 실행할 수 있다 (명세서 40.2).

export function photoRefs(images: ImageRecord[]): PhotoRef[] {
  return images.map((img, i) => ({
    imageId: img.id,
    number: i + 1,
    caption: img.source === "user" ? img.caption : `참고 이미지${img.attribution ? ` · ${img.attribution.author} / ${img.attribution.provider === "unsplash" ? "Unsplash" : "Pixabay"}` : ""}`,
    source: img.source === "user" ? "user" : "stock",
  }));
}

// 동기 버전: 개인화 없이 기본 맥락만 (내부용)
function baseContext(p: ProjectRecord): ProjectContext {
  if (!p.category || !p.goal) throw new ApiError("카테고리와 목적을 선택하세요.", false);
  return {
    quickText: p.quickText,
    category: p.category,
    goal: p.goal,
    tone: p.tone,
    platforms: p.platforms,
    hasSponsorship: p.hasSponsorship,
    industries: p.industries,
  };
}

// AI에 보내는 프로젝트 맥락 (Phase 2A 개인화 포함)
export async function projectContext(p: ProjectRecord): Promise<ProjectContext> {
  const base = baseContext(p);
  const { personalization } = await loadPersonalization(p);
  const active = personalization.voice || personalization.brand || personalization.userWords.length || personalization.preferredPhrases.length || personalization.cta;
  return active ? { ...base, personalization } : base;
}

async function load(projectId: string): Promise<ProjectRecord> {
  const p = await getProject(projectId);
  if (!p) throw new ApiError("프로젝트를 찾을 수 없습니다.", false);
  return p;
}

async function setStage(projectId: string, stage: PipelineStage, status: StageStatus, error?: { message: string; retryable: boolean }) {
  const p = await load(projectId);
  await updateProject(projectId, {
    stages: { ...p.stages, [stage]: status },
    stageError: error ? { stage, ...error } : status === "running" ? null : p.stageError,
  });
}

async function runStage(projectId: string, stage: PipelineStage, fn: () => Promise<void>): Promise<void> {
  const p = await load(projectId);
  if (p.stages[stage] === "done") return;
  await setStage(projectId, stage, "running");
  try {
    await fn();
    await setStage(projectId, stage, "done");
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    await setStage(projectId, stage, "failed", { message, retryable: err instanceof ApiError ? err.retryable : true });
    throw err;
  }
}

const evidence = (projectId: string, e: Omit<EvidenceRecord, "id" | "projectId" | "createdAt">): EvidenceRecord => ({
  id: uid(),
  projectId,
  createdAt: now(),
  ...e,
});

// ---------- 1~3단계 ----------

async function analyzeImagesStage(projectId: string) {
  const p = await load(projectId);
  // 스톡 이미지는 Visual Fact 추출 대상에서 제외 (명세서 8.3)
  const userImages = (await listImages(projectId)).filter((i) => i.source === "user" && i.analysis);
  if (!userImages.length) return;
  const numbers = new Map((await listImages(projectId)).map((img, i) => [img.id, i + 1]));
  const res = await api.analyzeImages({
    category: p.category!,
    quickText: p.quickText,
    images: await Promise.all(userImages.map(async (img) => ({ imageId: img.id, number: numbers.get(img.id)!, dataUrl: await blobToDataUrl(img.analysis!) }))),
  });
  await logUsage(projectId, res.usage);
  for (const a of res.images) {
    const img = userImages.find((i) => i.id === a.imageId);
    if (!img) continue;
    await updateImage(img.id, { caption: img.captionEdited ? img.caption : a.caption, visualFacts: a.facts, hasPeople: a.hasPeople });
  }
  await replaceEvidence(
    projectId,
    (e) => e.type === "visual",
    res.images.flatMap((a) =>
      a.facts.map((f) => evidence(projectId, { type: "visual", content: f.text, sourceType: "image", sourceRef: a.imageId, confidence: f.confidence, userVerified: false, isOpinion: false })),
    ),
  );
  await updateProject(projectId, { faceWarning: res.images.some((a) => a.hasPeople) });
}

async function organizeMemoryStage(projectId: string) {
  const p = await load(projectId);
  const res = await api.organizeMemory({ quickText: p.quickText, category: p.category!, goal: p.goal! });
  await logUsage(projectId, res.usage);
  await replaceEvidence(projectId, (e) => e.sourceType === "quick_text", [
    ...res.confirmedFacts.map((c) => evidence(projectId, { type: "confirmed", content: c, sourceType: "quick_text", sourceRef: null, confidence: null, userVerified: true, isOpinion: false })),
    ...res.userOpinions.map((c) => evidence(projectId, { type: "confirmed", content: c, sourceType: "quick_text", sourceRef: null, confidence: null, userVerified: true, isOpinion: true })),
  ]);

  // 브랜드 프로필·Content Memory 제품 정보 → 사용자가 등록한 Confirmed Fact (명세서 21.2, 22장)
  const { brand, products } = await loadPersonalization(p);
  const brandFacts = brand
    ? [brand.description && `${brand.name}: ${brand.description}`, brand.products && `${brand.name}의 제품·서비스: ${brand.products}`].filter((t): t is string => !!t)
    : [];
  await replaceEvidence(projectId, (e) => e.sourceType === "brand" || e.sourceType === "memory", [
    ...brandFacts.map((c) => evidence(projectId, { type: "confirmed", content: c, sourceType: "brand", sourceRef: brand!.id, confidence: null, userVerified: true, isOpinion: false })),
    ...products.map((m) => evidence(projectId, { type: "confirmed", content: m.detail ? `${m.title}: ${m.detail}` : m.title, sourceType: "memory", sourceRef: m.id, confidence: null, userVerified: true, isOpinion: false })),
  ]);

  // EXIF 촬영일시 → Metadata Fact (사용자 확인 전에는 본문에 쓰지 않는다, 명세서 7.2 C)
  const existing = (await listEvidence(projectId)).filter((e) => e.type === "metadata");
  const byDay = new Map<string, ImageRecord>();
  for (const img of await listImages(projectId)) if (img.source === "user" && img.takenAt && !byDay.has(isoDay(img.takenAt))) byDay.set(isoDay(img.takenAt), img);
  await replaceEvidence(
    projectId,
    (e) => e.type === "metadata",
    Array.from(byDay.values()).map((img) => {
      const content = `${formatTakenDate(img.takenAt!)} 촬영`;
      return evidence(projectId, {
        type: "metadata",
        content,
        sourceType: "exif",
        sourceRef: img.id,
        confidence: null,
        userVerified: existing.find((e) => e.content === content)?.userVerified ?? false,
        isOpinion: false,
      });
    }),
  );
}

async function checkMissingStage(projectId: string) {
  const p = await load(projectId);
  const all = await listEvidence(projectId);
  const takenDates = Array.from(
    new Set(
      (await listImages(projectId))
        .filter((i) => i.source === "user" && i.takenAt)
        .filter((i) => !all.some((e) => e.type === "metadata" && e.sourceRef === i.id && e.userVerified))
        .map((i) => isoDay(i.takenAt!)),
    ),
  );
  const res = await api.checkMissing({
    context: await projectContext(p),
    evidence: all.filter((e) => e.type !== "unknown").map((e) => ({ type: e.isOpinion ? "opinion" : e.type, content: e.content, confidence: e.confidence })),
    takenDates,
  });
  await logUsage(projectId, res.usage);
  await replaceEvidence(
    projectId,
    (e) => e.type === "unknown" || e.sourceType === "answer",
    res.unknowns.map((u) => evidence(projectId, { type: "unknown", content: u, sourceType: null, sourceRef: null, confidence: null, userVerified: false, isOpinion: false })),
  );
  await replaceQuestions(
    projectId,
    res.questions.map(
      (q, i): QuestionRecord => ({
        id: uid(),
        projectId,
        question: q.question,
        answerType: q.answerType,
        options: q.options,
        targetUnknown: q.targetUnknown,
        answer: null,
        skipped: false,
        sortOrder: i,
        createdAt: now(),
      }),
    ),
  );
  // 브랜드 프로필의 업종 태그를 함께 적용 (명세서 41.2 — Phase 2: Brand Profile 업종 태그)
  const { brand } = await loadPersonalization(p);
  if (!p.industriesConfirmed) await updateProject(projectId, { industries: Array.from(new Set([...res.industries, ...(brand?.industries ?? [])])) });
}

export async function runAnalyze(projectId: string): Promise<"questions" | "generate"> {
  await runStage(projectId, "analyze_images", () => analyzeImagesStage(projectId));
  await runStage(projectId, "organize_memory", () => organizeMemoryStage(projectId));
  await runStage(projectId, "check_missing", () => checkMissingStage(projectId));
  const p = await load(projectId);
  const questions = await listQuestions(projectId);
  return questions.length > 0 || (p.industries.length > 0 && !p.industriesConfirmed) ? "questions" : "generate";
}

// ---------- Smart Question 답변 ----------

const OPINION_QUESTION = /(어떻게 느|의향|좋았|만족|기억에 남|느낌|인상|이유)/;

export async function answerQuestion(q: QuestionRecord, answer: string | null): Promise<void> {
  if (answer === null) {
    await updateQuestion(q.id, { skipped: true, answer: null });
    await logEvent(q.projectId, "question_skip", { payload: { questionId: q.id } });
    return;
  }
  await updateQuestion(q.id, { skipped: false, answer });
  const all = await listEvidence(q.projectId);

  if (q.answerType === "date_confirm") {
    // 촬영일 확인 → Metadata Fact를 사용자 확인 상태로 승격
    for (const m of all.filter((e) => e.type === "metadata")) await updateEvidence(m.id, { userVerified: answer === "맞아요" });
    return;
  }
  await replaceEvidence(
    q.projectId,
    (e) => (e.sourceType === "answer" && e.sourceRef === q.id) || (e.type === "unknown" && !!q.targetUnknown && e.content === q.targetUnknown),
    [
      evidence(q.projectId, {
        type: "confirmed",
        content: q.targetUnknown ? `${q.targetUnknown}: ${answer}` : `${q.question} → ${answer}`,
        sourceType: "answer",
        sourceRef: q.id,
        confidence: null,
        userVerified: true,
        isOpinion: OPINION_QUESTION.test(q.question),
      }),
    ],
  );
}

// ---------- 4~6단계 ----------

async function composeStoryStage(projectId: string) {
  const p = await load(projectId);
  const res = await api.composeStory({
    context: await projectContext(p),
    evidence: (await listEvidence(projectId)).map(({ projectId: _p, createdAt: _c, ...e }) => e),
    photos: photoRefs(await listImages(projectId)),
  });
  await logUsage(projectId, res.usage);
  await updateProject(projectId, { masterStory: res.masterStory });
}

async function writeOne(p: ProjectRecord, platform: Platform): Promise<ContentRecord> {
  const res = await api.write({ platform, context: await projectContext(p), masterStory: p.masterStory!, photos: photoRefs(await listImages(p.id)) });
  await logUsage(p.id, res.usage);
  const content = await upsertContent(p.id, platform, { state: "ok", error: null, reviewError: null, aiFinalVersionId: null, generationNo: p.generationNo });
  await addVersion(content, res.content, "ai_generated");
  return content;
}

async function writeContentStage(projectId: string) {
  const p = await load(projectId);
  const existing = await listContents(projectId);
  const todo = p.platforms.filter((pl) => {
    const c = existing.find((x) => x.platform === pl);
    return !(c && c.state === "ok" && c.generationNo === p.generationNo && c.currentVersionId);
  });
  // 채널 단위로 저장하고, 한 채널이 실패해도 나머지는 유지한다
  const results = await Promise.allSettled(todo.map((pl) => writeOne(p, pl)));
  const failed: string[] = [];
  for (const [i, r] of results.entries()) {
    if (r.status === "rejected") {
      const message = r.reason instanceof Error ? r.reason.message : "작성에 실패했습니다.";
      await upsertContent(projectId, todo[i]!, { state: "failed", error: message, generationNo: p.generationNo });
      failed.push(todo[i]!);
    }
  }
  if (failed.length === todo.length && todo.length > 0) throw new ApiError((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason?.message ?? "콘텐츠 작성에 실패했습니다.", true);
}

async function reviewOne(p: ProjectRecord, content: ContentRecord, mode: "initial" | "recheck"): Promise<void> {
  const current = await getVersion(content.currentVersionId);
  if (!current) return;
  try {
    const res = await api.review({ platform: content.platform, context: await projectContext(p), masterStory: p.masterStory!, content: current.data });
    await logUsage(p.id, res.usage);
    let finalId = current.id;
    if (JSON.stringify(res.content) !== JSON.stringify(current.data)) {
      finalId = (await addVersion(content, res.content, "ai_rewrite")).id;
    }
    const issues: IssueRecord[] = res.issues.map((i) => ({ ...i, id: uid(), contentId: content.id, projectId: p.id, createdAt: now() }));
    await replaceIssues(content.id, issues);
    await upsertContent(p.id, content.platform, { reviewError: null, ...(mode === "initial" ? { aiFinalVersionId: finalId } : {}) });
  } catch (err) {
    await upsertContent(p.id, content.platform, {
      reviewError: err instanceof Error ? err.message : "품질 검토에 실패했습니다.",
      ...(mode === "initial" ? { aiFinalVersionId: current.id } : {}),
    });
    throw err;
  }
}

async function reviewStage(projectId: string) {
  const p = await load(projectId);
  const contents = (await listContents(projectId)).filter((c) => c.state === "ok" && c.generationNo === p.generationNo && !c.aiFinalVersionId && p.platforms.includes(c.platform));
  const results = await Promise.allSettled(contents.map((c) => reviewOne(p, c, "initial")));
  // 품질 검토 실패는 콘텐츠를 막지 않는다 — 채널별 경고로 남기고 편집기에서 다시 검사할 수 있다
  void results;
}

async function finish(projectId: string) {
  const p = await load(projectId);
  const contents = await listContents(projectId);
  const blog = contents.find((c) => c.platform === "blog" && c.state === "ok");
  const blogVersion = blog ? await getVersion(blog.currentVersionId) : undefined;
  const autoTitle = blogVersion?.data.platform === "blog" ? blogVersion.data.title : (p.masterStory?.what ?? p.title);
  await updateProject(projectId, { status: "generated", ...(p.titleEdited ? {} : { title: autoTitle.slice(0, 60) }) });
}

export async function runGenerate(projectId: string): Promise<void> {
  const p = await load(projectId);
  const firstRun = !p.stages.compose_story || p.stages.compose_story !== "done";
  await runStage(projectId, "compose_story", () => composeStoryStage(projectId));
  await runStage(projectId, "write_content", () => writeContentStage(projectId));
  await runStage(projectId, "review_quality", () => reviewStage(projectId));
  await finish(projectId);
  if (firstRun) {
    await logEvent(projectId, "generate", { payload: { platforms: p.platforms, generationNo: p.generationNo } });
    await markMemoryUsed([...p.productIds, ...(p.ctaId ? [p.ctaId] : [])]);
  }
}

// 입력을 바꾼 뒤 처음부터 다시 생성 (이전 버전 기록은 유지)
export async function resetPipeline(projectId: string): Promise<void> {
  const p = await load(projectId);
  await updateProject(projectId, { stages: {}, stageError: null, masterStory: null, generationNo: p.generationNo + 1, status: "draft" });
}

// 특정 채널만 다시 생성 (부분 실패 재시도, 채널 재생성)
export async function regenerateChannel(projectId: string, platform: Platform): Promise<void> {
  const p = await load(projectId);
  if (!p.masterStory) throw new ApiError("먼저 스토리를 생성하세요.", false);
  const content = await writeOne(p, platform);
  await reviewOne(p, content, "initial").catch(() => undefined);
  await logEvent(projectId, "regenerate", { contentId: content.id, payload: { platform } });
}

// 현재 버전을 다시 검사 (사용자 수정 후)
export async function recheckChannel(projectId: string, content: ContentRecord): Promise<void> {
  const p = await load(projectId);
  if (!p.masterStory) return;
  await reviewOne(p, content, "recheck");
}

export async function saveUserEdit(contentId: string, data: ChannelContent): Promise<void> {
  const content = await getContent(contentId);
  if (!content) return;
  const current = await getVersion(content.currentVersionId);
  if (current && JSON.stringify(current.data) === JSON.stringify(data)) return;
  // 같은 편집 흐름(10분 이내 연속 수정)은 한 버전으로 합친다
  if (current && current.origin === "user_edit" && Date.now() - new Date(current.updatedAt).getTime() < 10 * 60_000) {
    await updateVersionData(current.id, data);
    return;
  }
  await addVersion(content, data, "user_edit");
}
