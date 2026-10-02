import { z } from "zod";

// 명세서 1.4 용어집, 5장 Category

export const CATEGORIES = [
  { value: "travel", label: "여행", kind: "experience" },
  { value: "daily", label: "일상", kind: "experience" },
  { value: "cafe", label: "카페", kind: "experience" },
  { value: "restaurant", label: "맛집", kind: "experience" },
  { value: "product", label: "제품", kind: "experience" },
  { value: "service", label: "서비스", kind: "experience" },
  { value: "personal_branding", label: "개인 브랜딩", kind: "experience" },
  { value: "howto", label: "정보/노하우", kind: "info" },
] as const;

export const GOALS = [
  { value: "inform", label: "정보 전달" },
  { value: "review", label: "후기" },
  { value: "search_traffic", label: "검색 유입" },
  { value: "personal_branding", label: "개인 브랜딩" },
  { value: "product_promo", label: "제품 홍보" },
  { value: "visit", label: "방문 유도" },
  { value: "sales", label: "판매 유도" },
  { value: "share_experience", label: "경험 공유" },
] as const;

export const TONES = [
  { value: "plain", label: "담백한" },
  { value: "friendly", label: "친근한" },
  { value: "professional", label: "전문적인" },
  { value: "emotional", label: "감성적인" },
  { value: "refined", label: "세련된" },
  { value: "playful", label: "유쾌한" },
] as const;

export const PLATFORMS = [
  { value: "blog", label: "Blog" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "shorts", label: "YouTube Shorts" },
] as const;

// 명세서 19.2
export const PROJECT_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "generated", label: "Generated" },
  { value: "reviewed", label: "Reviewed" },
  { value: "ready", label: "Ready" },
  { value: "published", label: "Published" },
] as const;

type Values<T extends readonly { value: string }[]> = [T[number]["value"], ...T[number]["value"][]];
const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((item) => item.value) as Values<T>;

export const Category = z.enum(values(CATEGORIES));
export const Goal = z.enum(values(GOALS));
export const Tone = z.enum(values(TONES));
export const Platform = z.enum(values(PLATFORMS));
export const ProjectStatus = z.enum(values(PROJECT_STATUSES));

export type Category = z.infer<typeof Category>;
export type Goal = z.infer<typeof Goal>;
export type Tone = z.infer<typeof Tone>;
export type Platform = z.infer<typeof Platform>;
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const DEFAULT_TONE: Tone = "plain";

export function categoryKind(category: Category): "experience" | "info" {
  return CATEGORIES.find((c) => c.value === category)!.kind;
}

export function labelOf<T extends readonly { value: string; label: string }[]>(
  list: T,
  value: T[number]["value"],
): string {
  return list.find((item) => item.value === value)?.label ?? value;
}
