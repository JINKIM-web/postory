import { z } from "zod";

// 명세서 7.3 Smart Question

export const MAX_SMART_QUESTIONS = 4;

export const SmartQuestion = z.object({
  id: z.string(),
  question: z.string().min(1),
  answerType: z.enum(["choice", "text", "date_confirm"]),
  options: z.array(z.string()),
  // 어떤 Unknown을 보강하려는 질문인지
  targetUnknown: z.string().nullable(),
  answer: z.string().nullable(),
  skipped: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export type SmartQuestion = z.infer<typeof SmartQuestion>;

export const SmartQuestionAnswer = z.union([
  z.object({ skipped: z.literal(true) }),
  z.object({ skipped: z.literal(false), answer: z.string().trim().min(1).max(500) }),
]);

export type SmartQuestionAnswer = z.infer<typeof SmartQuestionAnswer>;
