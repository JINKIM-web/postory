import { describe, expect, it } from "vitest";
import { guessIndustries, runRuleChecks } from "./rules.js";
import { readinessScore, summarizeGroups } from "./summary.js";
import { htmlToText } from "./text.js";

describe("runRuleChecks", () => {
  it("L1 금칙어를 업종 추정과 무관하게 잡는다", () => {
    const issues = runRuleChecks({ platform: "blog", text: "이 차를 마시면 염증 치료에 좋아요." });
    expect(issues.some((i) => i.severity === "L1" && i.match === "염증 치료")).toBe(true);
  });

  it("업종 사전은 해당 업종일 때만 적용한다", () => {
    const text = "세포 재생 효과가 있는 세럼이에요.";
    expect(runRuleChecks({ platform: "blog", text }).some((i) => i.match === "세포 재생")).toBe(false);
    expect(runRuleChecks({ platform: "blog", text, industries: ["cosmetics"] }).some((i) => i.match === "세포 재생")).toBe(true);
  });

  it("L2 주의 표현은 대체어가 있으면 수정 제안을 만든다", () => {
    const [issue] = runRuleChecks({ platform: "facebook", text: "최고의 파스타였다." }).filter((i) => i.severity === "L2");
    expect(issue?.suggestion).toBe("좋은 파스타였다.");
  });

  it("Claim 패턴을 잡는다", () => {
    const issues = runRuleChecks({ platform: "blog", text: "국내 1위 카페라고 한다." });
    expect(issues.some((i) => i.checkType === "claim")).toBe(true);
  });

  it("키워드 과다 반복을 잡는다", () => {
    const text = Array.from({ length: 8 }, (_, i) => `성수동 카페 ${i}번째 문장이다.`).join(" ");
    const issues = runRuleChecks({ platform: "blog", text });
    expect(issues.some((i) => i.checkType === "keyword" && i.match === "성수동")).toBe(true);
  });

  it("광고·협찬 표기가 없으면 L1 이슈를 만든다", () => {
    const missing = runRuleChecks({ platform: "instagram", text: "좋았어요", hashtags: [], hasSponsorship: true });
    expect(missing.some((i) => i.checkType === "disclosure")).toBe(true);
    const present = runRuleChecks({ platform: "instagram", text: "좋았어요", hashtags: ["#광고"], hasSponsorship: true });
    expect(present.some((i) => i.checkType === "disclosure")).toBe(false);
  });

  it("Instagram 해시태그 권장 개수를 넘으면 안내한다", () => {
    const issues = runRuleChecks({ platform: "instagram", text: "캡션", hashtags: ["#a", "#b", "#c", "#d", "#e", "#f"] });
    expect(issues.some((i) => i.checkType === "length" && i.severity === "info")).toBe(true);
  });

  it("Shorts 길이가 최대치를 넘으면 L2", () => {
    const issues = runRuleChecks({ platform: "shorts", text: "", title: "제목", durationSec: 45 });
    expect(issues.some((i) => i.checkType === "length" && i.severity === "L2")).toBe(true);
  });
});

describe("summary", () => {
  it("열린 L1 이슈가 있으면 경고, 해결하면 통과", () => {
    const open = [{ checkType: "forbidden" as const, severity: "L1" as const, status: "open" as const }];
    expect(summarizeGroups(open).find((g) => g.key === "forbidden")?.status).toBe("warning");
    expect(readinessScore(open)).toBe(80);
    const fixed = [{ ...open[0]!, status: "accepted" as const }];
    expect(summarizeGroups(fixed).find((g) => g.key === "forbidden")?.status).toBe("pass");
    expect(readinessScore(fixed)).toBe(100);
  });
});

describe("htmlToText", () => {
  it("사진 마커를 [사진 N 삽입]으로 바꾼다", () => {
    const text = htmlToText('<h2>소제목</h2><div data-photo="2" data-caption="파스타"></div><p>본문 <strong>강조</strong></p>');
    expect(text).toBe("소제목\n\n[사진 2 삽입] 파스타\n\n본문 강조");
  });
});

describe("guessIndustries", () => {
  it("카페·맛집은 식품으로 추정한다", () => {
    expect(guessIndustries("", "cafe")).toContain("food");
    expect(guessIndustries("새로 나온 비타민 세럼", "product")).toEqual(expect.arrayContaining(["cosmetics", "health_food"]));
  });
});

describe("replaceSentence", async () => {
  const { replaceSentence } = await import("./content.js");
  it("굵은 문단 전체를 지우면 빈 태그를 남기지 않는다", () => {
    const next = replaceSentence({ platform: "blog", title: "t", titleCandidates: [], html: "<p><strong>지울 문장.</strong></p><p>남길 문장.</p>" }, "지울 문장.", "");
    expect(next?.platform === "blog" && next.html).toBe("<p>남길 문장.</p>");
  });
});

describe("사용자 금칙어 (L4)", () => {
  it("등록한 단어를 잡고 대체어로 제안한다", () => {
    const issues = runRuleChecks({ platform: "blog", text: "가성비 최강 카페였다.", userWords: [{ word: "가성비", replacement: "가격 대비 만족도" }] });
    const l4 = issues.find((i) => i.severity === "L4");
    expect(l4?.suggestion).toBe("가격 대비 만족도 최강 카페였다.");
    expect(summarizeGroups([{ checkType: "forbidden", severity: "L4", status: "open" }]).find((g) => g.key === "forbidden")?.status).toBe("improve");
  });
});
