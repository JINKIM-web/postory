import { z } from "zod";
import { insertDisclosure } from "@postory/quality";
import {
  platformRules,
  SPONSORSHIP_TAG,
  type BlogContent,
  type ChannelContent,
  type FacebookContent,
  type InstagramContent,
  type MasterStory,
  type PhotoRef,
  type ShortsContent,
  type WriteRequest,
  type WriteResponse,
} from "@postory/shared";
import { callJson } from "../llm.js";
import { contextBlock, EVIDENCE_POLICY, photosBlock, storyBlock, STYLE_POLICY } from "../prompts.js";
import { photoMarker, Section, sectionsToHtml } from "./blocks.js";

// 5단계: 채널별 작성 (명세서 8·16·17·18장). 모든 채널은 Master Story만 근거로 쓴다.

const BlogDraft = z.object({
  titleCandidates: z.array(z.string()),
  sections: z.array(Section),
});

const FacebookDraft = z.object({ hook: z.string(), story: z.string(), keyMessage: z.string(), cta: z.string() });

const InstagramDraft = z.object({
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  photoOrder: z.array(z.number().int()),
});

const ShortsDraft = z.object({
  title: z.string(),
  hook: z.string(),
  scenes: z.array(
    z.object({
      startSec: z.number(),
      endSec: z.number(),
      role: z.enum(["hook", "photo", "key_point", "cta"]),
      photoNumber: z.number().int().nullable(),
      overlayText: z.string(),
      narration: z.string(),
    }),
  ),
  caption: z.string(),
  description: z.string(),
  hashtags: z.array(z.string()),
});

function system(role: string): string {
  return `${role}\n\n${EVIDENCE_POLICY}\n\n${STYLE_POLICY}`;
}

const normalizeTag = (t: string) => `#${t.replace(/^#+/, "").replace(/\s+/g, "")}`;

// ---------- Mock (키 없이 흐름 확인용, 근거 문장을 그대로 재배치) ----------

function factsOf(story: MasterStory): string[] {
  return [...story.confirmedFacts.map((f) => f.text), ...story.visualFacts.filter((f) => f.confidence === "high").map((f) => f.text)];
}

function opinionsOf(story: MasterStory): string[] {
  return story.userOpinions.map((o) => `개인적으로는 ${o.text.replace(/[.!]$/, "")}.`);
}

const asSentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

function mockBlog(story: MasterStory, photos: PhotoRef[]): z.infer<typeof BlogDraft> {
  const facts = factsOf(story).map(asSentence).filter((f) => f !== asSentence(story.what));
  const opinions = opinionsOf(story);
  const subject = story.where ?? story.what;
  const sections: Section[] = [
    { heading: null, blocks: [{ kind: "paragraph", text: asSentence(story.what), items: null, ordered: null, photoNumber: null }] },
  ];
  photos.forEach((p, i) => {
    sections.push({
      heading: p.caption ?? `기록 ${i + 1}`,
      blocks: [
        { kind: "photo", text: null, items: null, ordered: null, photoNumber: p.number },
        ...(facts[i] ? [{ kind: "paragraph" as const, text: facts[i]!, items: null, ordered: null, photoNumber: null }] : []),
        ...(opinions[i] ? [{ kind: "paragraph" as const, text: opinions[i]!, items: null, ordered: null, photoNumber: null }] : []),
      ],
    });
  });
  const rest = facts.slice(photos.length);
  if (rest.length) sections.push({ heading: "기억에 남은 점", blocks: [{ kind: "paragraph", text: rest.join(" "), items: null, ordered: null, photoNumber: null }] });
  sections.push({
    heading: "핵심 정리",
    blocks: [{ kind: "list", text: null, items: [story.keyMessage, ...facts.slice(0, 2)].map((s) => s.replace(/\.$/, "")), ordered: false, photoNumber: null }],
  });
  if (story.cta) sections.push({ heading: null, blocks: [{ kind: "paragraph", text: story.cta, items: null, ordered: null, photoNumber: null }] });
  return {
    titleCandidates: [`${subject} 기록`, `${subject}, 직접 다녀온 이야기`, `${story.keyMessage.replace(/\.$/, "")}`],
    sections,
  };
}

// ---------- Blog ----------

// 근거 개수에 맞춘 목표 분량 (공백 제외). 고정된 1,200자 목표는 근거가 적을 때 지어내기를 부추겼다 (골든셋 평가 결과)
function evidenceCount(story: MasterStory): number {
  return story.confirmedFacts.length + story.userOpinions.length + story.visualFacts.length + story.metadataFacts.filter((m) => m.userVerified).length;
}

export function targetLength(story: MasterStory, photos: number, per = 120, base = 150, max = platformRules.blog.body.recommendedMax): number {
  return Math.min(max, Math.max(250, base + evidenceCount(story) * per + photos * 60));
}

async function writeBlog(req: WriteRequest): Promise<WriteResponse> {
  const { context, masterStory: story, photos } = req;
  const rules = platformRules.blog;
  const target = targetLength(story, photos.length);
  const sections = Math.min(5, Math.max(1, Math.ceil(evidenceCount(story) / 2)));
  const { data, usage } = await callJson({
    operation: "blog",
    tier: "main",
    schemaName: "blog_draft",
    schema: BlogDraft,
    system: system(`너는 네이버 블로그에 바로 올릴 수 있는 수준의 글을 쓰는 에디터다.
[구성] 도입(소제목 없음) → 소제목 최대 ${sections}개(근거가 있는 주제만, 사진이 있으면 각 소제목에 맞는 사진 1장) → 핵심 정리(리스트, 근거에 있는 내용만) → 마무리(소제목 없음, CTA).
- 제목 후보 3~5개 (${rules.title.recommendedMin}~${rules.title.recommendedMax}자, 검색하는 사람이 찾을 핵심 키워드를 자연스럽게 포함, 과장 없음).
- 본문 분량: 공백 제외 약 ${target}자 이내. 근거 하나당 1~3문장이면 충분하다. 이 분량을 넘기려고 묘사·이유·교훈을 덧붙이지 않는다.
- 사진은 kind "photo" 블록으로 넣고 photoNumber에 사진 번호를 쓴다. 모든 사진을 한 번씩, 내용과 맞는 위치에 배치한다.
- 문단은 1~3문장. 핵심 문장 1~2개만 **굵게** 표시한다.
- 광고·협찬 표기는 시스템이 자동으로 넣으므로 쓰지 않는다.`),
    user: `${contextBlock(context)}\n\n${storyBlock(story)}\n\n${photosBlock(photos)}`,
    mock: () => mockBlog(story, photos),
  });

  const used = new Set<number>();
  let html = sectionsToHtml(data.sections, photos, used);
  // 본문에서 빠진 사진은 마무리 앞에 붙인다 (ZIP 번호와 본문 마커를 맞추기 위해)
  const missing = photos.filter((p) => !used.has(p.number));
  if (missing.length) html += missing.map(photoMarker).join("");

  const titleCandidates = Array.from(new Set(data.titleCandidates.map((t) => t.trim()).filter(Boolean))).slice(0, 5);
  let content: BlogContent = { platform: "blog", title: titleCandidates[0] ?? story.what, titleCandidates, html };
  if (context.hasSponsorship) content = insertDisclosure(content) as BlogContent;
  return { content, usage: [usage] };
}

// ---------- Facebook ----------

async function writeFacebook(req: WriteRequest): Promise<WriteResponse> {
  const { context, masterStory: story } = req;
  const rules = platformRules.facebook;
  const { data, usage } = await callJson({
    operation: "channel",
    tier: "main",
    schemaName: "facebook_post",
    schema: FacebookDraft,
    system: system(`너는 Facebook 스토리형 포스트를 쓰는 에디터다.
[구조] Hook(첫 줄, 스크롤을 멈추게 하는 한 문장) → Story(경험 2~4문장) → Key Message(한 문장) → CTA(한 문장).
- 전체 공백 제외 약 ${targetLength(story, 0, 60, 100, rules.body.recommendedMax)}자 이내 (근거가 적으면 더 짧게). 친근하고 자연스럽게. 해시태그는 쓰지 않는다.`),
    user: `${contextBlock(context)}\n\n${storyBlock(story)}`,
    mock: () => ({
      hook: story.keyMessage,
      story: [...factsOf(story).slice(0, 3).map(asSentence), ...opinionsOf(story).slice(0, 1)].join(" "),
      keyMessage: asSentence(story.what),
      cta: story.cta ?? "비슷한 경험이 있다면 댓글로 이야기 나눠 주세요.",
    }),
  });
  let content: FacebookContent = { platform: "facebook", body: [data.hook, data.story, data.keyMessage, data.cta].map((s) => s.trim()).filter(Boolean).join("\n\n") };
  if (context.hasSponsorship) content = insertDisclosure(content) as FacebookContent;
  return { content, usage: [usage] };
}

// ---------- Instagram ----------

function validOrder(order: number[], photos: PhotoRef[]): number[] {
  const numbers = photos.map((p) => p.number);
  const seen = new Set<number>();
  const result = order.filter((n) => numbers.includes(n) && !seen.has(n) && seen.add(n));
  return [...result, ...numbers.filter((n) => !seen.has(n))];
}

async function writeInstagram(req: WriteRequest): Promise<WriteResponse> {
  const { context, masterStory: story, photos } = req;
  const rules = platformRules.instagram;
  const { data, usage } = await callJson({
    operation: "channel",
    tier: "main",
    schemaName: "instagram_post",
    schema: InstagramDraft,
    system: system(`너는 Instagram 피드 캡션을 쓰는 에디터다.
- Hook(첫 줄, 짧게) → body(개인적인 느낌 중심 2~4줄) → CTA(한 줄).
- 캡션 전체 ${rules.caption.recommendedMax}자 이내. 줄바꿈으로 읽기 쉽게.
- 해시태그 ${rules.hashtags.recommendedMax}개 이하, 근거에 있는 장소·주제만. 광고 태그는 시스템이 넣는다.
- photoOrder: 첫 장으로 가장 눈길을 끄는 사진이 오도록 사진 번호 순서를 정한다.`),
    user: `${contextBlock(context)}\n\n${storyBlock(story)}\n\n${photosBlock(photos)}`,
    mock: () => ({
      hook: story.keyMessage,
      body: [...opinionsOf(story).slice(0, 2), ...factsOf(story).slice(0, 1).map(asSentence)].join("\n"),
      cta: story.cta ?? "저장해 두고 필요할 때 꺼내 보세요.",
      hashtags: ["기록", "일상", "오늘의기록"],
      photoOrder: photos.map((p) => p.number),
    }),
  });
  const hashtags = Array.from(new Set(data.hashtags.map(normalizeTag).filter((t) => t.length > 1))).slice(0, rules.hashtags.recommendedMax);
  let content: InstagramContent = {
    platform: "instagram",
    caption: [data.hook, data.body, data.cta].map((s) => s.trim()).filter(Boolean).join("\n\n"),
    hashtags,
    photoOrder: validOrder(data.photoOrder, photos),
  };
  if (context.hasSponsorship) content = insertDisclosure(content) as InstagramContent;
  return { content, usage: [usage] };
}

// ---------- YouTube Shorts ----------

function fixScenes(scenes: ShortsContent["scenes"], photos: PhotoRef[]): ShortsContent["scenes"] {
  const max = platformRules.shorts.durationSec.max;
  const numbers = new Set(photos.map((p) => p.number));
  let t = 0;
  return scenes
    .map((s) => {
      const len = Math.max(1, Math.round(s.endSec - s.startSec) || 3);
      const scene = { ...s, startSec: t, endSec: Math.min(max, t + len), photoNumber: s.photoNumber && numbers.has(s.photoNumber) ? s.photoNumber : null };
      t = scene.endSec;
      return scene;
    })
    .filter((s) => s.endSec > s.startSec);
}

async function writeShorts(req: WriteRequest): Promise<WriteResponse> {
  const { context, masterStory: story, photos } = req;
  const rules = platformRules.shorts;
  const { data, usage } = await callJson({
    operation: "channel",
    tier: "main",
    schemaName: "shorts_script",
    schema: ShortsDraft,
    system: system(`너는 YouTube Shorts 스크립트를 쓰는 에디터다. 실제 영상은 만들지 않고 장면 구성과 대본만 쓴다.
- 전체 ${rules.durationSec.min}~${rules.durationSec.max}초. 장면 예: 0~2초 Hook → 2~5초 사진+자막 → 5~9초 사진+내레이션 → 9~15초 핵심 포인트 → 마지막 CTA.
- 각 장면: role, photoNumber(사진을 쓰면 번호, 아니면 null), overlayText(화면 자막 15자 이내), narration(한두 문장).
- title은 ${rules.title.recommendedMax}자 이내, description은 짧은 요약 2~3문장, 해시태그 3~5개(#Shorts 포함).`),
    user: `${contextBlock(context)}\n\n${storyBlock(story)}\n\n${photosBlock(photos)}`,
    mock: () => {
      const facts = factsOf(story);
      const photoScenes = photos.slice(0, 3).map((p, i) => ({
        startSec: 2 + i * 4,
        endSec: 6 + i * 4,
        role: "photo" as const,
        photoNumber: p.number,
        overlayText: (p.caption ?? `장면 ${i + 1}`).slice(0, 15),
        narration: asSentence(facts[i] ?? story.what),
      }));
      return {
        title: story.keyMessage.slice(0, 40),
        hook: story.keyMessage,
        scenes: [
          { startSec: 0, endSec: 2, role: "hook" as const, photoNumber: photos[0]?.number ?? null, overlayText: story.keyMessage.slice(0, 15), narration: story.keyMessage },
          ...photoScenes,
          { startSec: 14, endSec: 18, role: "cta" as const, photoNumber: null, overlayText: "저장해 두세요", narration: story.cta ?? "더 자세한 이야기는 블로그에 정리해 두었어요." },
        ],
        caption: story.keyMessage,
        description: asSentence(story.what),
        hashtags: ["#Shorts", "#기록"],
      };
    },
  });
  let content: ShortsContent = {
    platform: "shorts",
    title: data.title.trim().slice(0, rules.title.max),
    hook: data.hook.trim(),
    scenes: fixScenes(data.scenes, photos),
    caption: data.caption.trim(),
    description: data.description.trim(),
    hashtags: Array.from(new Set(data.hashtags.map(normalizeTag))).slice(0, 5),
  };
  if (context.hasSponsorship && !content.hashtags.includes(SPONSORSHIP_TAG)) {
    content = insertDisclosure({ ...content, hashtags: [SPONSORSHIP_TAG, ...content.hashtags] }) as ShortsContent;
  }
  return { content, usage: [usage] };
}

export function writeChannel(req: WriteRequest): Promise<WriteResponse> {
  const writers: Record<ChannelContent["platform"], (r: WriteRequest) => Promise<WriteResponse>> = {
    blog: writeBlog,
    facebook: writeFacebook,
    instagram: writeInstagram,
    shorts: writeShorts,
  };
  return writers[req.platform](req);
}
