import { z } from "zod";
import { Category, DEFAULT_TONE, Goal, Platform, Tone } from "./enums.js";

// 명세서 7.1 Smart Input

export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const QUICK_TEXT_MAX = 500;

// 미결 #5 이미지 리사이즈 기준 (초기값)
export const STORED_IMAGE_LONG_EDGE = 2048;
export const ANALYSIS_IMAGE_LONG_EDGE = 1024;
export const THUMBNAIL_LONG_EDGE = 400;

// 생성 시작 전 입력 검증
export const ProjectReadyInput = z.object({
  quickText: z.string().max(QUICK_TEXT_MAX),
  category: Category,
  goal: Goal,
  tone: Tone.default(DEFAULT_TONE),
  platforms: z.array(Platform).min(1, "채널을 1개 이상 선택하세요."),
  hasSponsorship: z.boolean(),
  photoCount: z.number().int().min(1, "사진을 1장 이상 올려 주세요.").max(MAX_PHOTOS, `사진은 최대 ${MAX_PHOTOS}장입니다.`),
});

export type ProjectReadyInput = z.infer<typeof ProjectReadyInput>;
