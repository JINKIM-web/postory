import { beforeAll, describe, expect, it } from "vitest";
import { channelText, htmlToText } from "@postory/quality";
import type { EvidenceItem, PhotoRef, ProjectContext } from "@postory/shared";

// OPENAI_API_KEY 없이 Mock 모드로 전체 단계를 이어서 실행한다.
beforeAll(() => {
  process.env.POSTORY_MOCK = "1";
});

const context: ProjectContext = {
  quickText: "지난 주말 성수동 카페에 갔다. 라떼를 주문했다. 커피가 좋았고 공간이 조용했다.",
  category: "cafe",
  goal: "share_experience",
  tone: "plain",
  platforms: ["blog", "facebook", "instagram", "shorts"],
  hasSponsorship: true,
  industries: [],
};

const photos: PhotoRef[] = [
  { imageId: "img-1", number: 1, caption: "카페 외관", source: "user" },
  { imageId: "img-2", number: 2, caption: "라떼", source: "user" },
];

describe("mock pipeline", () => {
  it("분석 → 질문 → 스토리 → 채널 작성 → 품질 검토가 이어진다", async () => {
    const { analyzeImages, checkMissing, organizeMemory } = await import("./stages/analyze.js");
    const { composeStory } = await import("./stages/story.js");
    const { writeChannel } = await import("./stages/write.js");
    const { review } = await import("./stages/review.js");

    const analyzed = await analyzeImages({
      category: "cafe",
      quickText: context.quickText,
      images: photos.map((p) => ({ imageId: p.imageId, number: p.number, dataUrl: "data:image/jpeg;base64,AAAA" })),
    });
    expect(analyzed.images).toHaveLength(2);

    const memory = await organizeMemory({ quickText: context.quickText, category: "cafe", goal: "share_experience" });
    expect(memory.userOpinions.length).toBeGreaterThan(0);

    const missing = await checkMissing({ context, evidence: [], takenDates: ["2026-09-26"] });
    expect(missing.questions[0]?.answerType).toBe("date_confirm");
    expect(missing.questions.length).toBeLessThanOrEqual(4);
    expect(missing.industries).toContain("food");

    const evidence: EvidenceItem[] = [
      ...memory.confirmedFacts.map((c, i) => ({ id: `c${i}`, type: "confirmed" as const, content: c, sourceType: "quick_text" as const, sourceRef: null, confidence: null, userVerified: true, isOpinion: false })),
      ...memory.userOpinions.map((c, i) => ({ id: `o${i}`, type: "confirmed" as const, content: c, sourceType: "quick_text" as const, sourceRef: null, confidence: null, userVerified: true, isOpinion: true })),
      { id: "m1", type: "metadata", content: "2026년 9월 26일 촬영", sourceType: "exif", sourceRef: "img-1", confidence: null, userVerified: false, isOpinion: false },
    ];
    const { masterStory } = await composeStory({ context, evidence, photos });
    expect(masterStory.when).toBeNull();
    expect(masterStory.userOpinions.length).toBe(memory.userOpinions.length);

    for (const platform of context.platforms) {
      const { content } = await writeChannel({ platform, context, masterStory, photos });
      const reviewed = await review({ platform, context, masterStory, content });
      const text = channelText(reviewed.content);
      const all = `${text.title ?? ""} ${text.text} ${(text.hashtags ?? []).join(" ")}`;
      expect(all, platform).toMatch(/광고|제공받아/);
      expect(reviewed.issues.some((i) => i.checkType === "disclosure" && i.status === "open")).toBe(false);
      if (reviewed.content.platform === "blog") {
        const plain = htmlToText(reviewed.content.html);
        expect(plain).toContain("[사진 1 삽입]");
        expect(plain).toContain("[사진 2 삽입]");
      }
    }
  });

  it("L1 표현은 자동 수정(삭제)된다", async () => {
    const { review } = await import("./stages/review.js");
    const { composeStory } = await import("./stages/story.js");
    const { masterStory } = await composeStory({ context: { ...context, hasSponsorship: false }, evidence: [], photos });
    const res = await review({
      platform: "facebook",
      context: { ...context, hasSponsorship: false },
      masterStory,
      content: { platform: "facebook", body: "커피가 맛있었다. 이 커피는 암 예방에 좋다. 다시 가고 싶다." },
    });
    expect(res.content.platform === "facebook" && res.content.body).not.toContain("암 예방");
    expect(res.issues.find((i) => i.severity === "L1")?.status).toBe("auto_fixed");
  });
});

describe("광고·협찬 표기 보호", () => {
  it("품질 검토가 문장을 지워도 표기 문구는 남는다", async () => {
    const { review } = await import("./stages/review.js");
    const { composeStory } = await import("./stages/story.js");
    const { SPONSORSHIP_DISCLOSURE } = await import("@postory/shared");
    const { masterStory } = await composeStory({ context, evidence: [], photos });
    const res = await review({
      platform: "blog",
      context,
      masterStory,
      content: { platform: "blog", title: "제목", titleCandidates: [], html: `<p><strong>${SPONSORSHIP_DISCLOSURE}</strong></p><p>이 차는 암 예방에 좋다.</p><p>맛있었다.</p>` },
    });
    const html = res.content.platform === "blog" ? res.content.html : "";
    expect(html).toContain(SPONSORSHIP_DISCLOSURE);
    expect(html).not.toContain("암 예방");
    expect(html).not.toMatch(/<p>\s*<\/p>|<strong>\s*<\/strong>/);
    expect(res.issues.some((i) => i.originalText.includes(SPONSORSHIP_DISCLOSURE))).toBe(false);
  });
});
