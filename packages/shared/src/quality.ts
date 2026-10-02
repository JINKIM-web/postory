import { z } from "zod";

// 명세서 10장 Content Quality Engine, 35.1 QualityIssue

export const CheckType = z.enum([
  "forbidden",
  "claim",
  "evidence",
  "keyword",
  "generic_phrase",
  "search",
  "tone",
  "length",
  "disclosure",
]);

// L4: 사용자 정의 금칙어 (Phase 2A)
export const Severity = z.enum(["L1", "L2", "L3", "L4", "info"]);

export const IssueStatus = z.enum(["open", "auto_fixed", "accepted", "ignored", "reverted"]);

export const QualityIssue = z.object({
  id: z.string(),
  checkType: CheckType,
  severity: Severity,
  spanStart: z.number().int().min(0).nullable(),
  spanEnd: z.number().int().min(0).nullable(),
  originalText: z.string(),
  reason: z.string(),
  suggestion: z.string().nullable(),
  status: IssueStatus,
});

export type CheckType = z.infer<typeof CheckType>;
export type Severity = z.infer<typeof Severity>;
export type IssueStatus = z.infer<typeof IssueStatus>;
export type QualityIssue = z.infer<typeof QualityIssue>;

// 사전 항목 (명세서 11장, 35.1 ForbiddenWord)
export const ForbiddenWord = z.object({
  word: z.string().min(1),
  matchType: z.enum(["exact", "regex"]),
  severity: z.enum(["L1", "L2", "L3", "L4"]),
  category: z.string(),
  industry: z.string().nullable(),
  replacement: z.string().nullable(),
});

export type ForbiddenWord = z.infer<typeof ForbiddenWord>;
