import { z } from "zod";

// Phase 2A — Personalization (명세서 21장 Brand Intelligence, 22장 Content Memory, 11장 Level 4)

// My Voice: 사용자의 기존 글에서 추출한 문체 특징 (명세서 21.1)
export const VoiceFeatures = z.object({
  sentenceLength: z.string(),
  speechStyle: z.string(),
  frequentExpressions: z.array(z.string()),
  avoidedExpressions: z.array(z.string()),
  paragraphStyle: z.string(),
  ctaStyle: z.string(),
  summary: z.string(),
});
export type VoiceFeatures = z.infer<typeof VoiceFeatures>;

export const VOICE_SAMPLE_MIN = 2;
export const VOICE_SAMPLE_MAX = 5;
export const VOICE_SAMPLE_CHARS = 4000;

export const AnalyzeVoiceRequest = z.object({
  samples: z
    .array(z.string().trim().min(100, "샘플 글은 100자 이상이어야 합니다.").max(VOICE_SAMPLE_CHARS))
    .min(VOICE_SAMPLE_MIN, `글을 ${VOICE_SAMPLE_MIN}개 이상 넣어 주세요.`)
    .max(VOICE_SAMPLE_MAX),
});
export type AnalyzeVoiceRequest = z.infer<typeof AnalyzeVoiceRequest>;

// Brand Profile (명세서 21.2) — 사용자가 직접 등록한 정보이므로 Confirmed Fact로 쓸 수 있다
export const BrandInfo = z.object({
  name: z.string(),
  description: z.string(),
  products: z.string(),
  targetCustomer: z.string(),
  keyMessage: z.string(),
  toneAndManner: z.string(),
});
export type BrandInfo = z.infer<typeof BrandInfo>;

// 사용자 정의 금칙어 (Level 4)
export const UserWord = z.object({
  word: z.string().min(1),
  replacement: z.string().nullable(),
});
export type UserWord = z.infer<typeof UserWord>;

// 생성 요청에 붙는 개인화 정보
export const Personalization = z.object({
  voice: VoiceFeatures.nullable(),
  brand: BrandInfo.nullable(),
  preferredPhrases: z.array(z.string()),
  userWords: z.array(UserWord),
  // Content Memory에서 고른 CTA (있으면 우선 사용)
  cta: z.string().nullable(),
});
export type Personalization = z.infer<typeof Personalization>;

export const EMPTY_PERSONALIZATION: Personalization = { voice: null, brand: null, preferredPhrases: [], userWords: [], cta: null };
