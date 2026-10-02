import type { CheckType, QualityIssue } from "@postory/shared";

// 품질 패널의 항목별 통과/개선/경고 요약과 Publish Readiness (명세서 9.2, 14장)
// LLM이 숫자 점수를 매기지 않고, 항목별 판정을 환산한다.

export const CHECK_GROUPS: { key: string; label: string; types: CheckType[]; weight: number }[] = [
  { key: "evidence", label: "사실 근거", types: ["evidence"], weight: 25 },
  { key: "forbidden", label: "금칙어", types: ["forbidden", "disclosure"], weight: 20 },
  { key: "claim", label: "과장 표현", types: ["claim"], weight: 15 },
  { key: "search", label: "검색 품질", types: ["search"], weight: 10 },
  { key: "keyword", label: "키워드 반복", types: ["keyword"], weight: 10 },
  { key: "generic", label: "AI 상투 표현", types: ["generic_phrase"], weight: 10 },
  { key: "tone", label: "선택 톤", types: ["tone"], weight: 5 },
  { key: "length", label: "분량·형식", types: ["length"], weight: 5 },
];

export type GroupStatus = "pass" | "improve" | "warning";

export interface GroupSummary {
  key: string;
  label: string;
  status: GroupStatus;
  openCount: number;
}

type IssueLike = Pick<QualityIssue, "checkType" | "severity" | "status">;

const isOpen = (i: IssueLike) => i.status === "open" || i.status === "reverted";

// labels: 그룹 이름 바꾸기 (예: My Voice 적용 시 "선택 톤" → "My Voice 일치", 명세서 14장)
export function summarizeGroups(issues: IssueLike[], applicable?: CheckType[], labels: Record<string, string> = {}): GroupSummary[] {
  return CHECK_GROUPS.filter((g) => !applicable || g.types.some((t) => applicable.includes(t))).map((g) => {
    const open = issues.filter((i) => g.types.includes(i.checkType) && isOpen(i));
    const status: GroupStatus = open.some((i) => i.severity === "L1")
      ? "warning"
      : open.some((i) => i.severity !== "info")
        ? "improve"
        : "pass";
    return { key: g.key, label: labels[g.key] ?? g.label, status, openCount: open.length };
  });
}

export function readinessScore(issues: IssueLike[]): number {
  let score = 100;
  for (const g of CHECK_GROUPS) {
    const open = issues.filter((i) => g.types.includes(i.checkType) && isOpen(i));
    if (open.some((i) => i.severity === "L1")) score -= g.weight;
    else if (open.some((i) => i.severity === "L2" || i.severity === "L3" || i.severity === "L4")) score -= Math.ceil(g.weight / 2);
    else if (open.length > 0) score -= Math.min(3, open.length);
  }
  return Math.max(0, score);
}
