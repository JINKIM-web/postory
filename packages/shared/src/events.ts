import { z } from "zod";

// 명세서 35.1 EventLog / UsageLog

export const EventType = z.enum([
  "generate",
  "regenerate",
  "section_regenerate",
  "copy_rich",
  "copy_plain",
  "download_zip",
  "download_text",
  "question_skip",
  "mark_published",
]);

export type EventType = z.infer<typeof EventType>;

export const UsageOperation = z.enum([
  "image_analysis",
  "question",
  "master_story",
  "blog",
  "channel",
  "review",
  "rewrite",
]);

export type UsageOperation = z.infer<typeof UsageOperation>;

// API 응답마다 붙는 사용량 정보 (클라이언트가 UsageLog로 저장)
export const UsageInfo = z.object({
  operation: UsageOperation,
  model: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  imageCount: z.number().int(),
  estimatedCostUsd: z.number(),
});

export type UsageInfo = z.infer<typeof UsageInfo>;
