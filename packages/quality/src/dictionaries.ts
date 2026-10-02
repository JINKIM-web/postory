// 금칙어·Claim·AI 상투 표현 사전 (명세서 11~13장, 41.2)
// 법률 검토 전 초기 사전이다 (미결 #9). 업종 태그가 null인 항목은 공통 사전.

export type Industry = "food" | "health_food" | "cosmetics" | "medical" | "finance" | "real_estate";

export const INDUSTRY_LABELS: Record<Industry, string> = {
  food: "일반식품",
  health_food: "건강기능식품",
  cosmetics: "화장품",
  medical: "의료·의약품",
  finance: "금융·투자",
  real_estate: "부동산",
};

export interface DictionaryEntry {
  pattern: string;
  // regex 항목은 pattern을 정규식으로 해석한다
  regex?: boolean;
  industry: Industry | null;
  reason: string;
  replacement?: string;
}

// Level 1 — 절대 금지. 발견 시 반드시 수정·삭제
export const LEVEL1: DictionaryEntry[] = [
  { pattern: "완치", industry: null, reason: "질병 치료를 단정하는 표현입니다." },
  { pattern: "질병 치료", industry: null, reason: "질병 치료를 단정하는 표현입니다." },
  { pattern: "(암|당뇨|고혈압|치매)\\s?예방", regex: true, industry: null, reason: "질병 예방 효능을 단정하는 표현입니다." },
  { pattern: "원금 보장", industry: null, reason: "수익·원금을 보장하는 표현은 금지됩니다." },
  { pattern: "확정 수익", industry: null, reason: "수익을 보장하는 표현은 금지됩니다." },
  { pattern: "무조건 수익", industry: null, reason: "수익을 보장하는 표현은 금지됩니다." },
  { pattern: "수익 보장", industry: null, reason: "수익을 보장하는 표현은 금지됩니다." },
  // 식품·건강기능식품·화장품 — 의약품 오인
  { pattern: "염증 (치료|완화)", regex: true, industry: "food", reason: "식품을 의약품으로 오인하게 하는 표현입니다." },
  { pattern: "약효", industry: "food", reason: "식품을 의약품으로 오인하게 하는 표현입니다." },
  { pattern: "(살|체지방)이? ?(쫙|확) ?빠", regex: true, industry: "health_food", reason: "체중 감량 효과를 단정하는 표현입니다." },
  { pattern: "면역력 (강화|증진)", regex: true, industry: "health_food", reason: "기능성 인정 범위를 넘을 수 있는 효능 표현입니다." },
  { pattern: "세포 재생", industry: "cosmetics", reason: "화장품을 의약품으로 오인하게 하는 표현입니다." },
  { pattern: "(여드름|아토피|피부염) (치료|완치)", regex: true, industry: "cosmetics", reason: "화장품을 의약품으로 오인하게 하는 표현입니다." },
  // 의견("~라고 느꼈다") 형태여도 효능 단정은 광고 규제 대상 (골든셋 product-3)
  {
    pattern: "(기미|주근깨|잡티|여드름|흉터|색소침착|주름)(가|이|는|은)?\\s?(완전히|싹|깨끗이|말끔히)?\\s?(없어|사라|제거|지워|개선|완화)",
    regex: true,
    industry: "cosmetics",
    reason: "화장품의 효능·효과를 단정하는 표현입니다. 개인 의견 형식이어도 쓸 수 없습니다.",
  },
  { pattern: "부작용 (없는|없음|제로)", regex: true, industry: "medical", reason: "의료 효과·안전성을 보장하는 표현입니다." },
  { pattern: "통증이? 사라", regex: true, industry: "medical", reason: "치료 효과를 단정하는 표현입니다." },
  { pattern: "개발 호재", industry: "real_estate", reason: "부동산 개발 호재를 단정하는 표현입니다." },
  { pattern: "시세 차익 보장", industry: "real_estate", reason: "수익을 보장하는 표현입니다." },
];

// Level 2 — 주의. 문맥 판단 필요 (명세서 10.1 ②)
export const LEVEL2: DictionaryEntry[] = [
  { pattern: "무조건", industry: null, reason: "단정적 표현입니다. 근거가 없다면 완화하세요.", replacement: "꼭" },
  { pattern: "100\\s?%", regex: true, industry: null, reason: "근거 없는 수치 단정입니다." },
  { pattern: "완벽한", industry: null, reason: "과장될 수 있는 표현입니다.", replacement: "만족스러운" },
  { pattern: "완벽하게", industry: null, reason: "과장될 수 있는 표현입니다.", replacement: "꼼꼼하게" },
  { pattern: "최고의", industry: null, reason: "근거 없는 최상급 표현입니다.", replacement: "좋은" },
  { pattern: "반드시", industry: null, reason: "단정적 표현입니다." },
  { pattern: "절대", industry: null, reason: "단정적 표현입니다." },
];

// Claim 패턴 — 최상급·인증·효능·가격 (명세서 12장)
export const CLAIMS: DictionaryEntry[] = [
  { pattern: "(국내|업계|전국)\\s?(1위|최초|최대)", regex: true, industry: null, reason: "확인되지 않은 순위·최초 표현입니다." },
  { pattern: "가장 (인기|유명|맛있)", regex: true, industry: null, reason: "확인되지 않은 최상급 표현입니다." },
  { pattern: "최저가", industry: null, reason: "확인되지 않은 가격 비교 표현입니다." },
  { pattern: "(공식|정부|식약처)\\s?인증", regex: true, industry: null, reason: "확인되지 않은 인증 표현입니다." },
  { pattern: "유일한", industry: null, reason: "확인되지 않은 유일성 표현입니다." },
  { pattern: "반드시 성공", industry: null, reason: "성과를 보장하는 표현입니다." },
  { pattern: "효과 (만점|보장)", regex: true, industry: null, reason: "확인되지 않은 효능 표현입니다." },
];

// AI 상투 표현 (명세서 13장)
export const GENERIC_PHRASES: DictionaryEntry[] = [
  { pattern: "오늘 소개해 ?드릴", regex: true, industry: null, reason: "AI 글에서 자주 보이는 도입 문구입니다." },
  { pattern: "정말 특별한 경험", industry: null, reason: "구체성이 없는 상투 표현입니다." },
  { pattern: "꼭 (방문|한번 방문)해 ?보시길", regex: true, industry: null, reason: "AI 글에서 자주 보이는 권유 문구입니다." },
  { pattern: "추천 ?드립니다", regex: true, industry: null, reason: "AI 글에서 자주 보이는 권유 문구입니다." },
  { pattern: "분위기 또한 매우", industry: null, reason: "구체성이 없는 상투 표현입니다." },
  { pattern: "잊지 못할 (추억|경험)", regex: true, industry: null, reason: "구체성이 없는 상투 표현입니다." },
  { pattern: "그럼 (지금부터|이제) (함께 )?(알아|살펴)", regex: true, industry: null, reason: "AI 글에서 자주 보이는 전환 문구입니다." },
  { pattern: "마치며", industry: null, reason: "AI 글에서 자주 보이는 마무리 문구입니다." },
];

// 업종 추정용 키워드 (MVP: Category·Quick Text 기반 추정 후 사용자 확인 — 명세서 41.2)
export const INDUSTRY_KEYWORDS: Record<Industry, string[]> = {
  food: ["음식", "식품", "간식", "음료", "차", "커피", "디저트"],
  health_food: ["건강기능식품", "영양제", "유산균", "비타민", "다이어트", "프로틴", "콜라겐"],
  cosmetics: ["화장품", "세럼", "크림", "앰플", "토너", "선크림", "스킨케어", "에센스"],
  medical: ["병원", "의원", "시술", "치료", "한의원", "약", "의료기기", "피부과"],
  finance: ["투자", "주식", "코인", "재테크", "펀드", "대출", "보험"],
  real_estate: ["부동산", "분양", "아파트", "오피스텔", "청약", "매매"],
};
