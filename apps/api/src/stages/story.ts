import { z } from "zod";
import type { ComposeStoryRequest, ComposeStoryResponse, MasterStory } from "@postory/shared";
import { runRuleChecks, type Industry } from "@postory/quality";
import { callJson } from "../llm.js";
import { contextBlock, EVIDENCE_POLICY } from "../prompts.js";

// 4단계: Master Story (명세서 7.4)
// LLM은 서술 요소(who/where/when/what/핵심 메시지/CTA)만 정하고,
// 사실 목록은 Evidence에서 그대로 옮겨 근거 없는 사실이 Master Story에 들어가지 않게 한다.

const StoryFrame = z.object({
  who: z.string().nullable(),
  where: z.string().nullable(),
  when: z.string().nullable(),
  what: z.string(),
  keyMessage: z.string(),
  cta: z.string().nullable(),
});

export async function composeStory(req: ComposeStoryRequest): Promise<ComposeStoryResponse> {
  const { context, evidence, photos } = req;
  // 사용자가 쓴 근거라도 L1(질병 치료·수익 보장 등) 표현은 글에 쓰지 않는다 (명세서 11.2, 41.2)
  const safe = (e: (typeof evidence)[number]) =>
    !runRuleChecks({ platform: "facebook", text: e.content, industries: context.industries as Industry[] }).some((i) => i.severity === "L1");
  const facts = evidence.filter((e) => e.type === "confirmed" && !e.isOpinion && safe(e));
  const opinions = evidence.filter((e) => e.type === "confirmed" && e.isOpinion && safe(e));
  const visuals = evidence.filter((e) => e.type === "visual");
  const metadata = evidence.filter((e) => e.type === "metadata");
  const unknowns = evidence.filter((e) => e.type === "unknown");
  const verifiedDates = metadata.filter((m) => m.userVerified);

  const evidenceText = [
    "확인된 사실:",
    ...facts.map((f) => `- ${f.content}`),
    "사용자 의견:",
    ...opinions.map((f) => `- ${f.content}`),
    "사진에서 확인:",
    ...visuals.map((f) => `- ${f.content} (신뢰도 ${f.confidence})`),
    "사용자가 확인한 촬영일:",
    ...verifiedDates.map((f) => `- ${f.content}`),
    "확인되지 않음:",
    ...unknowns.map((f) => `- ${f.content}`),
  ].join("\n");

  const { data, usage } = await callJson({
    operation: "master_story",
    tier: "main",
    schemaName: "story_frame",
    schema: StoryFrame,
    system: `너는 사용자의 실제 경험을 구조화하는 편집자다. 주어진 근거만으로 이야기의 뼈대를 만든다.
${EVIDENCE_POLICY}
- who/where/when은 근거에 있을 때만 채우고, 없으면 null.
- what은 무엇을 했는지 한 문장, keyMessage는 글 전체가 전할 핵심 한 문장(근거 기반).
- cta는 목적에 맞는 자연스러운 행동 제안 한 문장. 근거 없는 약속(할인, 혜택)은 넣지 않는다.`,
    user: `${contextBlock(context)}\n\n[근거]\n${evidenceText}`,
    mock: () => ({
      who: null,
      where: null,
      when: verifiedDates[0]?.content ?? null,
      what: facts[0]?.content ?? context.quickText.split(/[.\n]/)[0] ?? "경험 기록",
      keyMessage: opinions[0]?.content ?? facts[0]?.content ?? "직접 경험한 내용을 정리했습니다.",
      cta: null,
    }),
  });

  const sourceOf = (e: (typeof evidence)[number]) =>
    e.sourceType === "answer" ? `answer:${e.sourceRef}` : e.sourceType === "brand" || e.sourceType === "memory" ? e.sourceType : "quick_text";

  const masterStory: MasterStory = {
    ...data,
    // Content Memory에서 고른 CTA가 있으면 그대로 쓴다
    cta: context.personalization?.cta ?? data.cta,
    // 사용자가 확인하지 않은 날짜는 쓰지 않는다 (명세서 7.2 C)
    when: verifiedDates.length || facts.some((f) => /\d|월|일|요일|주말|오전|오후|저녁/.test(f.content)) ? data.when : null,
    category: context.category,
    goal: context.goal,
    tone: context.tone,
    confirmedFacts: facts.map((f) => ({ text: f.content, source: sourceOf(f) })),
    visualFacts: visuals.map((f) => ({ text: f.content, imageId: f.sourceRef ?? "", confidence: f.confidence ?? "low" })),
    metadataFacts: metadata.map((f) => ({ text: f.content, imageId: f.sourceRef ?? "", userVerified: f.userVerified })),
    unknowns: unknowns.map((u) => u.content),
    userOpinions: opinions.map((o) => ({ text: o.content, source: sourceOf(o) })),
    sponsorship: context.hasSponsorship,
    availablePhotos: photos.map((p) => ({ imageId: p.imageId, source: p.source, caption: p.caption })),
  };

  return { masterStory, usage: [usage] };
}
