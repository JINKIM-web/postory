import { z } from "zod";
import { guessIndustries, splitSentences } from "@postory/quality";
import {
  CATEGORIES,
  labelOf,
  MAX_SMART_QUESTIONS,
  type AnalyzeImagesRequest,
  type AnalyzeImagesResponse,
  type Category,
  type CheckMissingRequest,
  type CheckMissingResponse,
  type OrganizeMemoryRequest,
  type OrganizeMemoryResponse,
  type QuestionDraft,
} from "@postory/shared";
import { callJson } from "../llm.js";
import { contextBlock } from "../prompts.js";

// 1~3단계: 사진 분석, 기억 정리, 필요한 정보 확인 (명세서 7.2, 7.3)

const ImageAnalysis = z.object({
  images: z.array(
    z.object({
      number: z.number().int(),
      caption: z.string(),
      facts: z.array(z.object({ text: z.string(), confidence: z.enum(["high", "low"]) })),
      hasPeople: z.boolean(),
    }),
  ),
});

export async function analyzeImages(req: AnalyzeImagesRequest): Promise<AnalyzeImagesResponse> {
  const { data, usage } = await callJson({
    operation: "image_analysis",
    tier: "light",
    schemaName: "image_analysis",
    schema: ImageAnalysis,
    system: `너는 사진에서 '눈으로 확인되는 것'만 기록하는 분석가다.
- 사진마다 6~15자의 짧은 한국어 설명(caption)을 붙인다. 예: "매장 외관과 간판", "라떼 한 잔".
- facts에는 사진에서 실제로 보이는 사실만 1~4개 적는다. 추측(맛, 가격, 품질, 브랜드명 추정, 위치 추정)은 쓰지 않는다.
- 분명히 보이면 confidence "high", 흐릿하거나 해석이 필요하면 "low".
- 사람 얼굴이나 타인을 식별할 수 있는 요소(얼굴, 차량 번호판)가 보이면 hasPeople true.
- 사진 번호는 주어진 순서(1부터)를 그대로 쓴다.`,
    user: `카테고리: ${labelOf(CATEGORIES, req.category)}\n사용자 메모(참고용, 사진에 없는 내용을 사실로 쓰지 말 것): ${req.quickText || "(없음)"}\n사진 ${req.images.length}장을 순서대로 첨부했다. 번호: ${req.images.map((i) => i.number).join(", ")}`,
    images: req.images.map((i) => i.dataUrl),
    mock: () => ({
      images: req.images.map((i) => ({ number: i.number, caption: `사진 ${i.number}`, facts: [], hasPeople: false })),
    }),
  });

  const byNumber = new Map(data.images.map((i) => [i.number, i]));
  return {
    images: req.images.map((img) => {
      const a = byNumber.get(img.number);
      return {
        imageId: img.imageId,
        caption: a?.caption.trim() || `사진 ${img.number}`,
        facts: (a?.facts ?? []).filter((f) => f.text.trim()).slice(0, 4),
        hasPeople: a?.hasPeople ?? false,
      };
    }),
    usage: [usage],
  };
}

const Memory = z.object({ confirmedFacts: z.array(z.string()), userOpinions: z.array(z.string()) });

const OPINION_MARKERS = /(좋았|좋다|맛있|별로|아쉬|인상적|만족|추천|싶다|싶었|느꼈|느낌|최고|괜찮|편했|불편|예뻤|조용했|따뜻했)/;

export function mockOrganize(quickText: string): z.infer<typeof Memory> {
  const sentences = splitSentences(quickText.replace(/[,，]\s*/g, ". "));
  return {
    confirmedFacts: sentences.filter((s) => !OPINION_MARKERS.test(s)),
    userOpinions: sentences.filter((s) => OPINION_MARKERS.test(s)),
  };
}

export async function organizeMemory(req: OrganizeMemoryRequest): Promise<OrganizeMemoryResponse> {
  if (!req.quickText.trim()) return { confirmedFacts: [], userOpinions: [], usage: [] };
  const { data, usage } = await callJson({
    operation: "question",
    tier: "light",
    schemaName: "memory",
    schema: Memory,
    system: `사용자가 쓴 짧은 메모를 '객관적 사실'과 '사용자 의견(평가·감정)'으로 나눈다.
- 메모에 없는 내용을 추가하지 않는다. 의미를 바꾸지 말고 짧은 문장으로 정리한다.
- 사실 예: "토요일 오후에 방문", "파스타를 주문". 의견 예: "커피가 좋았다", "다시 오고 싶다".`,
    user: `카테고리: ${labelOf(CATEGORIES, req.category)}\n메모:\n${req.quickText}`,
    mock: () => mockOrganize(req.quickText),
  });
  return { ...data, usage: [usage] };
}

const MissingInfo = z.object({
  unknowns: z.array(z.string()),
  questions: z.array(
    z.object({
      question: z.string(),
      answerType: z.enum(["choice", "text"]),
      options: z.array(z.string()),
      targetUnknown: z.string(),
    }),
  ),
});

// Category별 기본 질문 (명세서 7.3 예시) — Mock 및 참고용
const DEFAULT_QUESTIONS: Partial<Record<Category, QuestionDraft[]>> = {
  restaurant: [
    { question: "어떤 메뉴가 가장 좋았나요?", answerType: "text", options: [], targetUnknown: "가장 좋았던 메뉴" },
    { question: "다시 방문할 의향이 있나요?", answerType: "choice", options: ["꼭 다시 갈 것 같아요", "기회가 되면요", "한 번이면 충분해요"], targetUnknown: "재방문 의향" },
    { question: "가격대는 어떻게 느꼈나요?", answerType: "choice", options: ["합리적이에요", "보통이에요", "조금 비싼 편이에요", "잘 모르겠어요"], targetUnknown: "가격에 대한 느낌" },
  ],
  cafe: [
    { question: "어떤 메뉴를 주문했나요?", answerType: "text", options: [], targetUnknown: "주문 메뉴" },
    { question: "어떤 목적으로 방문했나요?", answerType: "choice", options: ["혼자 쉬러", "작업·공부", "친구와 대화", "데이트"], targetUnknown: "방문 목적" },
  ],
  travel: [
    { question: "이 장소에서 가장 기억에 남은 점은 무엇인가요?", answerType: "text", options: [], targetUnknown: "가장 기억에 남은 점" },
    { question: "누구와 함께 갔나요?", answerType: "choice", options: ["혼자", "친구", "가족", "연인"], targetUnknown: "동행" },
  ],
  product: [
    { question: "직접 써본 기능 중 가장 만족한 점은 무엇인가요?", answerType: "text", options: [], targetUnknown: "가장 만족한 점" },
    { question: "얼마나 사용해 보셨나요?", answerType: "choice", options: ["며칠", "1~2주", "한 달 이상"], targetUnknown: "사용 기간" },
  ],
  service: [{ question: "이 서비스를 쓰게 된 계기는 무엇인가요?", answerType: "text", options: [], targetUnknown: "사용 계기" }],
  personal_branding: [{ question: "이 경험에서 배운 점을 한 문장으로 말한다면?", answerType: "text", options: [], targetUnknown: "배운 점" }],
  daily: [{ question: "이 순간이 기억에 남는 이유는 무엇인가요?", answerType: "text", options: [], targetUnknown: "개인적 의미" }],
  howto: [{ question: "이 방법을 써야 하는 사람은 어떤 상황에 있나요?", answerType: "text", options: [], targetUnknown: "대상 독자의 상황" }],
};

function dateQuestion(dates: string[]): QuestionDraft | null {
  const unique = Array.from(new Set(dates)).sort();
  if (!unique.length) return null;
  const fmt = (d: string) => {
    const [, m, day] = d.split("-");
    return `${Number(m)}월 ${Number(day)}일`;
  };
  const label = unique.length === 1 ? fmt(unique[0]!) : `${fmt(unique[0]!)}~${fmt(unique.at(-1)!)}`;
  return {
    question: `사진 촬영일이 ${label}로 확인됩니다. 이 날 방문(사용)한 것이 맞나요?`,
    answerType: "date_confirm",
    options: ["맞아요", "아니에요"],
    targetUnknown: "방문 날짜",
  };
}

export async function checkMissing(req: CheckMissingRequest): Promise<CheckMissingResponse> {
  const { context, evidence } = req;
  const known = evidence.map((e) => `- [${e.type}${e.confidence ? `/${e.confidence}` : ""}] ${e.content}`).join("\n") || "- (없음)";
  const dateQ = dateQuestion(req.takenDates);
  const budget = MAX_SMART_QUESTIONS - (dateQ ? 1 : 0);

  const { data, usage } = await callJson({
    operation: "question",
    tier: "light",
    schemaName: "missing_info",
    schema: MissingInfo,
    system: `너는 콘텐츠를 쓰기 전에 부족한 정보를 찾는 편집자다.
- 이 카테고리·목적의 글에 꼭 필요하지만 근거에 없는 정보를 unknowns에 적는다 (예: 가격, 영업시간, 대기 시간, 재방문 의향).
- 그중 사용자만 답할 수 있고 글의 품질을 크게 높이는 것만 골라 질문을 만든다. 최대 ${budget}개, 필요 없으면 0개.
- 이미 근거에 있는 내용은 묻지 않는다. 날짜는 묻지 않는다.
- 선택형(choice, 보기 2~4개)을 우선하고, 꼭 필요할 때만 주관식(text, options는 빈 배열).
- 질문은 짧고 부드러운 존댓말로.`,
    user: `${contextBlock(context)}\n\n[현재 근거]\n${known}`,
    mock: () => {
      const questions = (DEFAULT_QUESTIONS[context.category] ?? []).map((q) => ({ ...q, answerType: q.answerType as "choice" | "text", targetUnknown: q.targetUnknown ?? "" }));
      return { unknowns: questions.map((q) => q.targetUnknown), questions };
    },
  });

  const questions: QuestionDraft[] = data.questions.slice(0, budget).map((q) => ({
    question: q.question,
    answerType: q.answerType === "choice" && q.options.length >= 2 ? "choice" : "text",
    options: q.answerType === "choice" ? q.options.slice(0, 4) : [],
    targetUnknown: q.targetUnknown || null,
  }));
  if (dateQ) questions.unshift(dateQ);

  const allText = `${context.quickText}\n${evidence.map((e) => e.content).join("\n")}`;
  return {
    unknowns: Array.from(new Set(data.unknowns.map((u) => u.trim()).filter(Boolean))),
    questions,
    industries: guessIndustries(allText, context.category),
    usage: [usage],
  };
}
