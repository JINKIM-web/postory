import { z } from "zod";
import { ChannelContent } from "./content.js";
import { Category, Goal, Platform, Tone } from "./enums.js";
import { Confidence, EvidenceItem } from "./evidence.js";
import { UsageInfo } from "./events.js";
import { MasterStory } from "./masterStory.js";
import { Personalization, VoiceFeatures } from "./personalization.js";
import { CheckType, Severity } from "./quality.js";

// 브라우저 ↔ API 계약. API는 상태를 저장하지 않으며(로컬 MVP), 필요한 입력을 매 요청에 모두 받는다.

export const ProjectContext = z.object({
  quickText: z.string(),
  category: Category,
  goal: Goal,
  tone: Tone,
  platforms: z.array(Platform),
  hasSponsorship: z.boolean(),
  industries: z.array(z.string()),
  // Phase 2A 개인화 (없으면 적용하지 않음)
  personalization: Personalization.optional(),
});
export type ProjectContext = z.infer<typeof ProjectContext>;

export const PhotoRef = z.object({
  imageId: z.string(),
  number: z.number().int().min(1),
  caption: z.string().nullable(),
  source: z.enum(["user", "stock"]),
});
export type PhotoRef = z.infer<typeof PhotoRef>;

// 1. 사진 분석
export const AnalyzeImagesRequest = z.object({
  category: Category,
  quickText: z.string(),
  images: z.array(z.object({ imageId: z.string(), number: z.number().int(), dataUrl: z.string().startsWith("data:image/") })).min(1).max(10),
});
export const AnalyzedImage = z.object({
  imageId: z.string(),
  caption: z.string(),
  facts: z.array(z.object({ text: z.string(), confidence: Confidence })),
  hasPeople: z.boolean(),
});
export const AnalyzeImagesResponse = z.object({ images: z.array(AnalyzedImage), usage: z.array(UsageInfo) });
export type AnalyzeImagesRequest = z.infer<typeof AnalyzeImagesRequest>;
export type AnalyzedImage = z.infer<typeof AnalyzedImage>;
export type AnalyzeImagesResponse = z.infer<typeof AnalyzeImagesResponse>;

// 2. 기억 정리
export const OrganizeMemoryRequest = z.object({ quickText: z.string(), category: Category, goal: Goal });
export const OrganizeMemoryResponse = z.object({
  confirmedFacts: z.array(z.string()),
  userOpinions: z.array(z.string()),
  usage: z.array(UsageInfo),
});
export type OrganizeMemoryRequest = z.infer<typeof OrganizeMemoryRequest>;
export type OrganizeMemoryResponse = z.infer<typeof OrganizeMemoryResponse>;

// 3. 필요한 정보 확인
export const EvidenceLite = z.object({ type: z.string(), content: z.string(), confidence: Confidence.nullable() });
export const CheckMissingRequest = z.object({
  context: ProjectContext,
  evidence: z.array(EvidenceLite),
  // 사용자 확인 전 EXIF 촬영일 (YYYY-MM-DD)
  takenDates: z.array(z.string()),
});
export const QuestionDraft = z.object({
  question: z.string(),
  answerType: z.enum(["choice", "text", "date_confirm"]),
  options: z.array(z.string()),
  targetUnknown: z.string().nullable(),
});
export const CheckMissingResponse = z.object({
  unknowns: z.array(z.string()),
  questions: z.array(QuestionDraft),
  industries: z.array(z.string()),
  usage: z.array(UsageInfo),
});
export type CheckMissingRequest = z.infer<typeof CheckMissingRequest>;
export type QuestionDraft = z.infer<typeof QuestionDraft>;
export type CheckMissingResponse = z.infer<typeof CheckMissingResponse>;

// 4. 스토리 구성
export const ComposeStoryRequest = z.object({
  context: ProjectContext,
  evidence: z.array(EvidenceItem),
  photos: z.array(PhotoRef),
});
export const ComposeStoryResponse = z.object({ masterStory: MasterStory, usage: z.array(UsageInfo) });
export type ComposeStoryRequest = z.infer<typeof ComposeStoryRequest>;
export type ComposeStoryResponse = z.infer<typeof ComposeStoryResponse>;

// 5. 콘텐츠 작성
export const WriteRequest = z.object({
  platform: Platform,
  context: ProjectContext,
  masterStory: MasterStory,
  photos: z.array(PhotoRef),
});
export const WriteResponse = z.object({ content: ChannelContent, usage: z.array(UsageInfo) });
export type WriteRequest = z.infer<typeof WriteRequest>;
export type WriteResponse = z.infer<typeof WriteResponse>;

// 6. 품질 검토 (규칙 → 문맥 검토 → 부분 재작성 → 재검증)
export const ReviewIssue = z.object({
  checkType: CheckType,
  severity: Severity,
  originalText: z.string(),
  reason: z.string(),
  suggestion: z.string().nullable(),
  status: z.enum(["open", "auto_fixed", "reverted"]),
});
export const ReviewRequest = z.object({
  platform: Platform,
  context: ProjectContext,
  masterStory: MasterStory,
  content: ChannelContent,
});
export const ReviewResponse = z.object({
  content: ChannelContent,
  issues: z.array(ReviewIssue),
  usage: z.array(UsageInfo),
});
export type ReviewIssue = z.infer<typeof ReviewIssue>;
export type ReviewRequest = z.infer<typeof ReviewRequest>;
export type ReviewResponse = z.infer<typeof ReviewResponse>;

// 섹션·문단 재작성 (명세서 8.4, 벤치마크 17장)
export const RewriteMode = z.enum(["rewrite", "shorter", "natural", "informative", "conversational"]);
export type RewriteMode = z.infer<typeof RewriteMode>;
export const REWRITE_MODE_LABELS: Record<RewriteMode, string> = {
  rewrite: "다시 쓰기",
  shorter: "더 짧게",
  natural: "더 자연스럽게",
  informative: "정보 보강",
  conversational: "더 대화체로",
};

export const RewriteRequest = z.object({
  platform: Platform,
  mode: RewriteMode,
  context: ProjectContext,
  masterStory: MasterStory,
  // Blog: 섹션 순수 텍스트(소제목 포함), 그 외: 본문 텍스트
  text: z.string().min(1),
});
export const RewriteResponse = z.object({
  // Blog 섹션은 HTML, 그 외는 순수 텍스트
  html: z.string().nullable(),
  text: z.string(),
  usage: z.array(UsageInfo),
});
export type RewriteRequest = z.infer<typeof RewriteRequest>;
export type RewriteResponse = z.infer<typeof RewriteResponse>;

// 스톡 이미지 (Phase 1C, 명세서 8.3)
export const StockImage = z.object({
  provider: z.enum(["pixabay", "unsplash"]),
  id: z.string(),
  thumbUrl: z.string(),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  author: z.string(),
  authorUrl: z.string(),
  pageUrl: z.string(),
  // Unsplash: 사용자가 선택하면 호출해야 하는 다운로드 추적 엔드포인트
  downloadLocation: z.string().nullable(),
});
export type StockImage = z.infer<typeof StockImage>;

// My Voice 분석 (Phase 2A)
export const AnalyzeVoiceResponse = z.object({ features: VoiceFeatures, usage: z.array(UsageInfo) });
export type AnalyzeVoiceResponse = z.infer<typeof AnalyzeVoiceResponse>;

export const HealthResponse = z.object({
  mode: z.enum(["openai", "mock"]),
  stock: z.object({ pixabay: z.boolean(), unsplash: z.boolean() }),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
