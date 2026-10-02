import { z } from "zod";
import { Category, Goal, Tone } from "./enums.js";
import { Confidence } from "./evidence.js";

// 명세서 7.4 Master Story
// OpenAI Structured Output(strict)에 그대로 쓰므로 모든 필드는 필수이며, 값이 없으면 null 또는 빈 배열로 둔다.

export const ConfirmedFactRef = z.object({
  text: z.string(),
  // "quick_text" 또는 "answer:{question_id}"
  source: z.string(),
});

export const VisualFactRef = z.object({
  text: z.string(),
  imageId: z.string(),
  confidence: Confidence,
});

export const MetadataFactRef = z.object({
  text: z.string(),
  imageId: z.string(),
  userVerified: z.boolean(),
});

export const UserOpinion = z.object({
  text: z.string(),
  source: z.string(),
});

export const AvailablePhoto = z.object({
  imageId: z.string(),
  source: z.enum(["user", "stock"]),
  caption: z.string().nullable(),
});

export const MasterStory = z.object({
  who: z.string().nullable(),
  where: z.string().nullable(),
  when: z.string().nullable(),
  what: z.string(),
  category: Category,
  goal: Goal,
  tone: Tone,
  confirmedFacts: z.array(ConfirmedFactRef),
  visualFacts: z.array(VisualFactRef),
  metadataFacts: z.array(MetadataFactRef),
  unknowns: z.array(z.string()),
  userOpinions: z.array(UserOpinion),
  keyMessage: z.string(),
  cta: z.string().nullable(),
  sponsorship: z.boolean(),
  availablePhotos: z.array(AvailablePhoto),
});

export type MasterStory = z.infer<typeof MasterStory>;
