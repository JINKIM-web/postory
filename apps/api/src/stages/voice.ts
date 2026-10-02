import { splitSentences } from "@postory/quality";
import { VoiceFeatures, type AnalyzeVoiceRequest, type AnalyzeVoiceResponse } from "@postory/shared";
import { callJson } from "../llm.js";

// My Voice 분석 (명세서 21.1): 기존 글에서 문장 길이, 말투, 자주 쓰는/피하는 표현, 문단 구성, CTA 스타일을 뽑는다.
// 원문은 저장하지 않고 특징만 돌려준다.

function mockFeatures(samples: string[]): VoiceFeatures {
  const sentences = samples.flatMap((s) => splitSentences(s));
  const avg = Math.round(sentences.reduce((n, s) => n + s.length, 0) / Math.max(1, sentences.length));
  const endings = new Map<string, number>();
  for (const s of sentences) {
    const end = s.replace(/[.!?~]+$/, "").slice(-2);
    endings.set(end, (endings.get(end) ?? 0) + 1);
  }
  const top = Array.from(endings.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([e]) => `~${e}`);
  const polite = sentences.filter((s) => /(요|니다)[.!?~]*$/.test(s)).length > sentences.length / 2;
  const paragraphs = samples.flatMap((s) => s.split(/\n\s*\n/)).filter((p) => p.trim());
  return {
    sentenceLength: `평균 ${avg}자 (${avg < 30 ? "짧은 편" : avg < 50 ? "보통" : "긴 편"})`,
    speechStyle: polite ? "존댓말" : "평어(반말·서술체)",
    frequentExpressions: top,
    avoidedExpressions: [],
    paragraphStyle: `문단당 평균 ${Math.round(sentences.length / Math.max(1, paragraphs.length))}문장`,
    ctaStyle: "샘플에서 판단할 수 없음",
    summary: `${polite ? "존댓말" : "평어"}, 문장 ${avg < 30 ? "짧게" : avg < 50 ? "보통 길이로" : "길게"}, 어미 ${top.join(" ")} 위주`,
  };
}

export async function analyzeVoice(req: AnalyzeVoiceRequest): Promise<AnalyzeVoiceResponse> {
  const { data, usage } = await callJson({
    operation: "question",
    tier: "light",
    schemaName: "voice_features",
    schema: VoiceFeatures,
    system: `너는 글쓴이의 문체를 분석하는 편집자다. 주어진 글들에서 공통된 문체 특징만 뽑는다.
- 내용(무엇을 경험했는지)이 아니라 쓰는 방식만 분석한다.
- sentenceLength: 문장 길이 경향 (예: "짧은 문장 위주, 가끔 긴 문장으로 리듬").
- speechStyle: 말투 (예: "친근한 존댓말 '~요'", "담담한 평어 '~했다'").
- frequentExpressions: 반복해서 쓰는 표현·어미·말버릇 3~6개 (원문 그대로).
- avoidedExpressions: 이 사람이 쓰지 않는 유형 (예: 이모지, 감탄사, 과장 표현) 0~5개.
- paragraphStyle: 문단 구성 (예: "2~3문장 짧은 문단, 줄바꿈 많음").
- ctaStyle: 글 마무리·권유 방식.
- summary: 위 특징을 한 문장으로 (글 작성 지시로 바로 쓸 수 있게).`,
    user: req.samples.map((s, i) => `[글 ${i + 1}]\n${s}`).join("\n\n"),
    mock: () => mockFeatures(req.samples),
  });
  return { features: data, usage: [usage] };
}
