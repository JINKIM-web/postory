import { CATEGORIES, GOALS, TONES, labelOf, type Category, type MasterStory, type ProjectContext, type Tone } from "@postory/shared";

// 공통 프롬프트 조각 (명세서 7.2 Evidence, 11~13장 품질, 41.1 생성 정책)

export const EVIDENCE_POLICY = `[사실 근거 원칙 — 반드시 지킬 것]
1. 아래에 주어진 근거(확인된 사실, 사진에서 확인된 정보, 사용자가 확인한 촬영일, 사용자 의견)에 있는 내용만 쓴다.
2. 근거에 없는 경험·사실·수치는 절대 만들지 않는다. 가격, 영업시간, 대기 시간, 재료, 주차, 위치, 직원 응대, 판매량, 순위, 인증, 효능, 성분, 타인의 평가는 근거에 없으면 아예 쓰지 않는다(완곡한 표현으로도 쓰지 않는다).
3. "확인되지 않은 정보" 목록에 있는 항목은 언급하지 않는다.
4. 사진에서 확인된 정보 중 신뢰도 low인 것은 "~처럼 보였다" 같은 관찰 표현으로만 쓸 수 있다.
5. 사용자 의견은 "개인적으로", "제 기준에서는"처럼 의견임이 드러나게 쓰고, 사실처럼 단정하지 않는다.
6. 날짜·요일은 사용자가 직접 말했거나 확인한 경우에만 쓴다.
7. 최상급·보장·단정 표현(최고, 완벽한, 무조건, 100%, 1위, 유일한, 반드시)은 쓰지 않는다.
8. 근거를 부풀리지 않는다. 근거에 없는 감각 묘사(맛의 변화, 분위기·소리·빛), 동기·이유·계기, 느낀 점의 해석, 일반화된 교훈, 독자에게 주는 팁을 새로 만들지 않는다.
9. 근거가 적으면 글이 짧아도 된다. 분량을 채우려고 같은 사실을 다른 말로 되풀이하지 않는다.
10. 의견·느낌·평가 문장은 [사용자 의견] 목록에 있는 것만 쓴다. "개인적으로", "제 기준에서는"을 붙여도 목록에 없는 새 의견·느낌·평가는 만들지 않는다.
11. 글 자체에 대한 메타 문장("이번 글에서는", "과장 없이 정리한다", "카테고리: ○○")은 쓰지 않는다.`;

export const STYLE_POLICY = `[문체 원칙]
- 실제 사람이 쓴 것처럼 구체적으로 쓴다. 다음 같은 AI 상투 표현은 쓰지 않는다: "오늘 소개해드릴", "정말 특별한 경험", "꼭 방문해보시길 추천드립니다", "분위기 또한 매우", "잊지 못할 추억", "마치며".
- "~했는데요"를 반복하지 않는다. 같은 어미가 연속되지 않게 문장 길이와 어미에 리듬을 준다.
- 같은 키워드를 억지로 반복하지 않는다. 검색 키워드는 자연스럽게 1~3회만 쓴다.
- 사용자가 쓴 표현을 살린다.`;

const TONE_GUIDE: Record<Tone, string> = {
  plain: "담백한: 꾸밈을 줄이고 사실과 느낌을 차분하게 전달한다. 감탄사·이모지 없음.",
  friendly: "친근한: 대화하듯 편안한 존댓말. 이모지는 거의 쓰지 않는다.",
  professional: "전문적인: 정확하고 정돈된 문장. 정보 위주, 과장 없음.",
  emotional: "감성적인: 분위기와 느낌을 묘사하되 근거 없는 사실을 덧붙이지 않는다.",
  refined: "세련된: 간결하고 절제된 문장, 잡지 에디토리얼 톤.",
  playful: "유쾌한: 가볍고 위트 있게, 단 과장하지 않는다.",
};

const CATEGORY_GUIDE: Record<Category, string> = {
  travel: "장소, 동선, 방문 경험, 분위기, 팁, 추천 대상",
  daily: "경험, 생각, 감정, 하루의 흐름, 개인적 의미",
  cafe: "공간, 메뉴, 분위기, 방문 목적, 추천 대상",
  restaurant: "주문 메뉴, 맛에 대한 사용자 평가, 가격(사용자 제공 시), 분위기, 재방문 의향, 추천 대상",
  product: "제품 특징, 사용 경험, 장점, 사용 맥락, 활용법",
  service: "사용자 문제, 서비스 사용 맥락, 해결 방식, 경험, 추천 대상",
  personal_branding: "경험, 전문성, 인사이트, 배운 점, 가치관",
  howto: "문제 정의, 해결 방법, 단계별 팁, 핵심 정리",
};

export function contextBlock(ctx: Pick<ProjectContext, "category" | "goal" | "tone" | "personalization">): string {
  const base = `[작성 조건]
- 카테고리: ${labelOf(CATEGORIES, ctx.category)} (작성 방향: ${CATEGORY_GUIDE[ctx.category]})
- 목적: ${labelOf(GOALS, ctx.goal)}
- 톤: ${TONE_GUIDE[ctx.tone]}
- 언어: 한국어`;
  const p = personalizationBlock(ctx.personalization);
  return p ? `${base}\n\n${p}` : base;
}

// Phase 2A — My Voice·Brand Profile·선호 표현·사용자 금칙어 (명세서 21장)
// 브랜드 정보는 문체·맥락 참고용이며, 본문에 쓸 사실은 Master Story(근거)에 들어간 것만 쓴다.
export function personalizationBlock(p: ProjectContext["personalization"]): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.voice) {
    const v = p.voice;
    parts.push(`[My Voice — 사용자의 실제 문체. 선택 톤보다 우선해 이 문체를 따른다]
- 요약: ${v.summary}
- 문장 길이: ${v.sentenceLength}
- 말투: ${v.speechStyle}
- 문단 구성: ${v.paragraphStyle}
- CTA 스타일: ${v.ctaStyle}
- 자주 쓰는 표현(자연스러울 때만): ${v.frequentExpressions.join(", ") || "없음"}
- 쓰지 않는 표현: ${v.avoidedExpressions.join(", ") || "없음"}`);
  }
  if (p.brand) {
    const b = p.brand;
    parts.push(`[브랜드 프로필 — 톤과 맥락 참고용]
- 브랜드: ${b.name}
- 타깃 고객: ${b.targetCustomer || "미입력"}
- 핵심 메시지: ${b.keyMessage || "미입력"}
- Tone & Manner: ${b.toneAndManner || "미입력"}`);
  }
  if (p.preferredPhrases.length) parts.push(`[선호 표현 — 자연스러울 때만 사용] ${p.preferredPhrases.join(", ")}`);
  if (p.userWords.length) parts.push(`[사용자 금칙어 — 절대 쓰지 말 것] ${p.userWords.map((w) => w.word).join(", ")}`);
  if (p.cta) parts.push(`[사용자가 고른 CTA — 마무리에 이 문장(또는 거의 같은 뜻)을 쓴다] ${p.cta}`);
  return parts.join("\n\n");
}

export function toneLabel(tone: Tone): string {
  return labelOf(TONES, tone);
}

// 품질 검토의 톤 기준: My Voice가 있으면 그 문체, 없으면 선택 톤 (명세서 10.1 ②)
export function toneTarget(ctx: Pick<ProjectContext, "tone" | "personalization">): string {
  return ctx.personalization?.voice ? `사용자 My Voice(${ctx.personalization.voice.summary})` : `선택 톤(${toneLabel(ctx.tone)})`;
}

export function storyBlock(story: MasterStory): string {
  const list = (items: string[]) => (items.length ? items.map((t) => `- ${t}`).join("\n") : "- (없음)");
  const photoNo = (imageId: string) => story.availablePhotos.findIndex((p) => p.imageId === imageId) + 1 || "?";
  return `[Master Story — 유일한 근거]
누가: ${story.who ?? "(미상)"}
어디서: ${story.where ?? "(미상)"}
언제: ${story.when ?? "(미상 — 날짜를 쓰지 말 것)"}
무엇을: ${story.what}
핵심 메시지: ${story.keyMessage}
CTA: ${story.cta ?? "(없음)"}

확인된 사실:
${list(story.confirmedFacts.map((f) => f.text))}

사진에서 확인된 정보:
${list(story.visualFacts.map((f) => `${f.text} (사진 ${photoNo(f.imageId)}, 신뢰도 ${f.confidence})`))}

사용자가 확인한 촬영일:
${list(story.metadataFacts.filter((f) => f.userVerified).map((f) => f.text))}

사용자 의견 (의견임을 드러내서 쓸 것):
${list(story.userOpinions.map((o) => o.text))}

확인되지 않은 정보 (언급 금지):
${list(story.unknowns)}`;
}

export function photosBlock(photos: { number: number; caption: string | null; source: string }[]): string {
  if (!photos.length) return "[사진] 없음";
  return `[사진 목록 — 번호는 바꾸지 말 것]
${photos.map((p) => `- 사진 ${p.number}: ${p.caption ?? "설명 없음"}${p.source === "stock" ? " (참고 이미지 — 사용자 경험의 증거로 쓰지 말 것)" : ""}`).join("\n")}`;
}
