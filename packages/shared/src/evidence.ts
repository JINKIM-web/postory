import { z } from "zod";

// 명세서 7.2 Evidence Engine

export const EvidenceType = z.enum(["confirmed", "visual", "metadata", "unknown"]);
export const EvidenceSourceType = z.enum(["quick_text", "answer", "image", "exif", "brand", "memory"]);
export const Confidence = z.enum(["high", "low"]);

export const EvidenceItem = z.object({
  id: z.string(),
  type: EvidenceType,
  content: z.string().min(1),
  sourceType: EvidenceSourceType.nullable(),
  // question_id 또는 image_id
  sourceRef: z.string().nullable(),
  // visual 전용
  confidence: Confidence.nullable(),
  // metadata → confirmed 승격 여부
  userVerified: z.boolean(),
  // 사용자 평가(의견) — 객관적 사실과 구분해 쓴다 (명세서 7.2 정책 3)
  isOpinion: z.boolean(),
});

export type EvidenceType = z.infer<typeof EvidenceType>;
export type EvidenceSourceType = z.infer<typeof EvidenceSourceType>;
export type EvidenceItem = z.infer<typeof EvidenceItem>;

// 완곡 표현으로도 쓸 수 없는 정보 유형 (명세서 7.2 정책 2)
export const NEVER_HEDGE_TOPICS = ["가격", "효능", "성분", "순위", "인증", "타인의 평가"] as const;
