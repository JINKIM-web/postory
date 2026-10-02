import { z } from "zod";

// 채널별 콘텐츠 형식 (명세서 8·16·17·18장)
// Blog 본문은 편집기(TipTap) HTML로 저장한다. 사진 마커는 <div data-photo="N" data-caption="..."></div>.

// 블로그 상단 대표 카드 이미지 — 대표 사진 또는 Unsplash 이미지 위에 제목을 얹은 카드
export const CoverUnsplash = z.object({
  id: z.string(),
  url: z.string(),
  thumbUrl: z.string(),
  author: z.string(),
  authorUrl: z.string(),
  pageUrl: z.string(),
});

export const BlogCover = z.object({
  enabled: z.boolean(),
  source: z.enum(["photo", "unsplash"]),
  // source=photo: 본문 사진 번호(1부터)
  photoNumber: z.number().int().min(1).nullable(),
  unsplash: CoverUnsplash.nullable(),
  // 카드에 얹을 글. null이면 블로그 제목을 그대로 쓴다
  headline: z.string().nullable(),
  subline: z.string(),
  showText: z.boolean(),
  ratio: z.enum(["1:1", "4:3", "16:9"]),
  theme: z.enum(["dark", "light"]),
});

export const BlogContent = z.object({
  platform: z.literal("blog"),
  title: z.string(),
  titleCandidates: z.array(z.string()),
  html: z.string(),
  // 없으면 대표 사진(첫 번째 사용자 사진)으로 기본 카드를 보여준다
  cover: BlogCover.optional(),
});

export type CoverUnsplash = z.infer<typeof CoverUnsplash>;
export type BlogCover = z.infer<typeof BlogCover>;
export const COVER_MARKER = "[대표 카드 이미지 삽입]";

export const FacebookContent = z.object({
  platform: z.literal("facebook"),
  body: z.string(),
});

export const InstagramContent = z.object({
  platform: z.literal("instagram"),
  caption: z.string(),
  hashtags: z.array(z.string()),
  // 사진 번호(1부터) 순서. 첫 번째가 대표 이미지
  photoOrder: z.array(z.number().int().min(1)),
});

export const ShortsScene = z.object({
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  role: z.enum(["hook", "photo", "key_point", "cta"]),
  photoNumber: z.number().int().min(1).nullable(),
  overlayText: z.string(),
  narration: z.string(),
});

export const ShortsContent = z.object({
  platform: z.literal("shorts"),
  title: z.string(),
  hook: z.string(),
  scenes: z.array(ShortsScene),
  caption: z.string(),
  description: z.string(),
  hashtags: z.array(z.string()),
});

export const ChannelContent = z.discriminatedUnion("platform", [
  BlogContent,
  FacebookContent,
  InstagramContent,
  ShortsContent,
]);

export type BlogContent = z.infer<typeof BlogContent>;
export type FacebookContent = z.infer<typeof FacebookContent>;
export type InstagramContent = z.infer<typeof InstagramContent>;
export type ShortsScene = z.infer<typeof ShortsScene>;
export type ShortsContent = z.infer<typeof ShortsContent>;
export type ChannelContent = z.infer<typeof ChannelContent>;

export type ContentVersionOrigin = "ai_generated" | "ai_rewrite" | "section_regenerated" | "user_edit" | "issue_fix" | "restored";

// 광고·협찬 표기 문구 (명세서 41.2) — 법률 검토 전 기본 문구
export const SPONSORSHIP_DISCLOSURE = "본 게시물은 업체로부터 제품 또는 서비스를 제공받아 작성했습니다.";
export const SPONSORSHIP_TAG = "#광고";
