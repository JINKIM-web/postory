import { DEFAULT_TONE, type ChannelContent, type ContentVersionOrigin, type EventType, type Platform, type UsageInfo } from "@postory/shared";
import { getDb, notify, now, PROFILE_STORES, PROJECT_CHILD_STORES, uid } from "./db";
import type {
  ContentRecord,
  EvidenceRecord,
  EventRecord,
  ImageRecord,
  IssueRecord,
  ProjectRecord,
  QuestionRecord,
  VersionRecord,
} from "./types";

// ---------- Project ----------

export async function createProject(init: Partial<ProjectRecord> = {}): Promise<ProjectRecord> {
  const ts = now();
  const project: ProjectRecord = {
    id: uid(),
    title: "새 스토리",
    titleEdited: false,
    category: null,
    goal: null,
    tone: DEFAULT_TONE,
    platforms: ["blog"],
    hasSponsorship: false,
    status: "draft",
    quickText: "",
    industries: [],
    industriesConfirmed: false,
    masterStory: null,
    stages: {},
    stageError: null,
    faceWarning: false,
    generationNo: 0,
    useVoice: false,
    brandId: null,
    productIds: [],
    ctaId: null,
    publishedMarkedAt: null,
    createdAt: ts,
    updatedAt: ts,
    ...init,
  };
  await (await getDb()).put("projects", project);
  notify("projects");
  return project;
}

// Phase 2A 이전에 저장된 프로젝트에 새 필드 기본값을 채운다
const withDefaults = (p: ProjectRecord): ProjectRecord => ({ useVoice: false, brandId: null, productIds: [], ctaId: null, ...(p as Partial<ProjectRecord>) }) as ProjectRecord;

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  const p = await (await getDb()).get("projects", id);
  return p && withDefaults(p);
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const all = await (await getDb()).getAllFromIndex("projects", "byUpdated");
  return all.reverse().map(withDefaults);
}

export async function updateProject(id: string, patch: Partial<ProjectRecord>): Promise<ProjectRecord> {
  const db = await getDb();
  const current = await getProject(id);
  if (!current) throw new Error("프로젝트를 찾을 수 없습니다.");
  const next = { ...current, ...patch, updatedAt: now() };
  await db.put("projects", next);
  notify("projects");
  return next;
}

// 프로젝트 삭제 시 사진·근거·콘텐츠·로그를 모두 삭제한다 (명세서 40.4)
export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["projects", ...PROJECT_CHILD_STORES], "readwrite");
  for (const store of PROJECT_CHILD_STORES) {
    const s = tx.objectStore(store);
    for (const key of await s.index("byProject").getAllKeys(id)) await s.delete(key);
  }
  await tx.objectStore("projects").delete(id);
  await tx.done;
  notify("projects", ...PROJECT_CHILD_STORES);
}

// 입력값과 사진만 복제한다 (생성 결과는 새로 만든다)
export async function duplicateProject(id: string): Promise<ProjectRecord> {
  const source = await getProject(id);
  if (!source) throw new Error("프로젝트를 찾을 수 없습니다.");
  const copy = await createProject({
    title: `${source.title} (복사본)`,
    titleEdited: true,
    category: source.category,
    goal: source.goal,
    tone: source.tone,
    platforms: source.platforms,
    hasSponsorship: source.hasSponsorship,
    quickText: source.quickText,
    useVoice: source.useVoice,
    brandId: source.brandId,
    productIds: source.productIds,
    ctaId: source.ctaId,
  });
  const db = await getDb();
  for (const img of await listImages(id)) {
    await db.put("images", { ...img, id: uid(), projectId: copy.id, visualFacts: [], hasPeople: false, createdAt: now() });
  }
  notify("images");
  return copy;
}

// ---------- Images ----------

export async function listImages(projectId: string): Promise<ImageRecord[]> {
  const all = await (await getDb()).getAllFromIndex("images", "byProject", projectId);
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function putImage(image: ImageRecord): Promise<void> {
  await (await getDb()).put("images", image);
  notify("images");
}

export async function updateImage(id: string, patch: Partial<ImageRecord>): Promise<void> {
  const db = await getDb();
  const current = await db.get("images", id);
  if (!current) return;
  await db.put("images", { ...current, ...patch });
  notify("images");
}

export async function reorderImages(projectId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("images", "readwrite");
  for (const img of await tx.store.index("byProject").getAll(projectId)) {
    const idx = orderedIds.indexOf(img.id);
    await tx.store.put({ ...img, sortOrder: idx === -1 ? orderedIds.length : idx });
  }
  await tx.done;
  notify("images");
}

export async function deleteImage(projectId: string, id: string): Promise<void> {
  await (await getDb()).delete("images", id);
  const rest = (await listImages(projectId)).map((i) => i.id);
  await reorderImages(projectId, rest);
}

// ---------- Evidence / Questions ----------

export async function listEvidence(projectId: string): Promise<EvidenceRecord[]> {
  const all = await (await getDb()).getAllFromIndex("evidence", "byProject", projectId);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// 조건에 맞는 기존 근거를 지우고 새 근거로 바꾼다 (단계 재실행 시 중복 방지)
export async function replaceEvidence(projectId: string, match: (e: EvidenceRecord) => boolean, items: EvidenceRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("evidence", "readwrite");
  for (const e of await tx.store.index("byProject").getAll(projectId)) if (match(e)) await tx.store.delete(e.id);
  for (const item of items) await tx.store.put(item);
  await tx.done;
  notify("evidence");
}

export async function updateEvidence(id: string, patch: Partial<EvidenceRecord>): Promise<void> {
  const db = await getDb();
  const current = await db.get("evidence", id);
  if (!current) return;
  await db.put("evidence", { ...current, ...patch });
  notify("evidence");
}

export async function listQuestions(projectId: string): Promise<QuestionRecord[]> {
  const all = await (await getDb()).getAllFromIndex("questions", "byProject", projectId);
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function replaceQuestions(projectId: string, items: QuestionRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("questions", "readwrite");
  for (const key of await tx.store.index("byProject").getAllKeys(projectId)) await tx.store.delete(key);
  for (const item of items) await tx.store.put(item);
  await tx.done;
  notify("questions");
}

export async function updateQuestion(id: string, patch: Partial<QuestionRecord>): Promise<void> {
  const db = await getDb();
  const current = await db.get("questions", id);
  if (!current) return;
  await db.put("questions", { ...current, ...patch });
  notify("questions");
}

// ---------- Contents / Versions ----------

export async function listContents(projectId: string): Promise<ContentRecord[]> {
  return (await getDb()).getAllFromIndex("contents", "byProject", projectId);
}

export async function getContent(id: string): Promise<ContentRecord | undefined> {
  return (await getDb()).get("contents", id);
}

export async function getContentByPlatform(projectId: string, platform: Platform): Promise<ContentRecord | undefined> {
  return (await listContents(projectId)).find((c) => c.platform === platform);
}

export async function upsertContent(projectId: string, platform: Platform, patch: Partial<ContentRecord>): Promise<ContentRecord> {
  const db = await getDb();
  const existing = await getContentByPlatform(projectId, platform);
  const ts = now();
  const record: ContentRecord = existing
    ? { ...existing, ...patch, updatedAt: ts }
    : { id: uid(), projectId, platform, generationNo: 0, currentVersionId: null, aiFinalVersionId: null, state: "ok", error: null, reviewError: null, createdAt: ts, updatedAt: ts, ...patch };
  await db.put("contents", record);
  notify("contents");
  return record;
}

export async function listVersions(contentId: string): Promise<VersionRecord[]> {
  const all = await (await getDb()).getAllFromIndex("versions", "byContent", contentId);
  return all.sort((a, b) => b.versionNo - a.versionNo);
}

export async function getVersion(id: string | null): Promise<VersionRecord | undefined> {
  if (!id) return undefined;
  return (await getDb()).get("versions", id);
}

// 새 버전을 만들고 현재 버전으로 지정한다 (명세서 8.4 — 이전 버전으로 되돌리기 가능)
export async function addVersion(content: ContentRecord, data: ChannelContent, origin: ContentVersionOrigin): Promise<VersionRecord> {
  const db = await getDb();
  const versions = await listVersions(content.id);
  const ts = now();
  const version: VersionRecord = {
    id: uid(),
    contentId: content.id,
    projectId: content.projectId,
    versionNo: (versions[0]?.versionNo ?? 0) + 1,
    origin,
    data,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.put("versions", version);
  const latest = (await db.get("contents", content.id)) ?? content;
  await db.put("contents", { ...latest, currentVersionId: version.id, updatedAt: ts });
  notify("versions", "contents");
  return version;
}

export async function updateVersionData(id: string, data: ChannelContent): Promise<void> {
  const db = await getDb();
  const current = await db.get("versions", id);
  if (!current) return;
  await db.put("versions", { ...current, data, updatedAt: now() });
  notify("versions");
}

// ---------- Issues ----------

export async function listIssues(contentId: string): Promise<IssueRecord[]> {
  const all = await (await getDb()).getAllFromIndex("issues", "byContent", contentId);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function replaceIssues(contentId: string, items: IssueRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("issues", "readwrite");
  for (const key of await tx.store.index("byContent").getAllKeys(contentId)) await tx.store.delete(key);
  for (const item of items) await tx.store.put(item);
  await tx.done;
  notify("issues");
}

export async function updateIssue(id: string, patch: Partial<IssueRecord>): Promise<void> {
  const db = await getDb();
  const current = await db.get("issues", id);
  if (!current) return;
  await db.put("issues", { ...current, ...patch });
  notify("issues");
}

// ---------- Logs ----------

export async function logEvent(
  projectId: string,
  eventType: EventType,
  extra: { contentId?: string | null; versionId?: string | null; payload?: Record<string, unknown> } = {},
): Promise<void> {
  const record: EventRecord = {
    id: uid(),
    projectId,
    contentId: extra.contentId ?? null,
    versionId: extra.versionId ?? null,
    eventType,
    payload: extra.payload ?? {},
    createdAt: now(),
  };
  await (await getDb()).put("events", record);
  notify("events");
}

export async function logUsage(projectId: string, usage: UsageInfo[]): Promise<void> {
  if (!usage.length) return;
  const db = await getDb();
  const tx = db.transaction("usage", "readwrite");
  for (const u of usage) await tx.store.put({ ...u, id: uid(), projectId, createdAt: now() });
  await tx.done;
  notify("usage");
}

export async function listEventsSince(iso: string): Promise<EventRecord[]> {
  return (await getDb()).getAllFromIndex("events", "byCreated", IDBKeyRange.lowerBound(iso));
}

export async function listAllEvents(): Promise<EventRecord[]> {
  return (await getDb()).getAll("events");
}

export async function listAllUsage() {
  return (await getDb()).getAll("usage");
}

export async function listProjectEvents(projectId: string): Promise<EventRecord[]> {
  return (await getDb()).getAllFromIndex("events", "byProject", projectId);
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const stores = ["projects", ...PROJECT_CHILD_STORES, ...PROFILE_STORES] as const;
  const tx = db.transaction(stores, "readwrite");
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  await tx.done;
  notify(...stores);
}
