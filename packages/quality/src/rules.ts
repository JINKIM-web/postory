import { platformRules, SPONSORSHIP_DISCLOSURE, type CheckType, type Platform, type Severity, type UserWord } from "@postory/shared";
import { CLAIMS, GENERIC_PHRASES, INDUSTRY_KEYWORDS, LEVEL1, LEVEL2, type DictionaryEntry, type Industry } from "./dictionaries.js";
import { splitSentences } from "./text.js";

// 명세서 10.1 ① Rule-based Pre-check — LLM을 쓰지 않는 결정적 점검

export interface RuleIssue {
  checkType: CheckType;
  severity: Severity;
  // 문제가 있는 문장 (본문에서 그대로 찾을 수 있는 문자열)
  originalText: string;
  // 문장 안에서 걸린 표현
  match: string;
  reason: string;
  suggestion: string | null;
}

export interface RuleInput {
  platform: Platform;
  // 본문 순수 텍스트 (해시태그 제외)
  text: string;
  title?: string;
  hashtags?: string[];
  industries?: Industry[];
  hasSponsorship?: boolean;
  // Shorts 장면 총 길이(초)
  durationSec?: number;
  // 사용자 정의 금칙어 (Level 4, Phase 2A)
  userWords?: UserWord[];
}

function toRegex(entry: DictionaryEntry): RegExp {
  const source = entry.regex ? entry.pattern : entry.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(source, "g");
}

function dictionaryIssues(
  sentences: string[],
  entries: DictionaryEntry[],
  checkType: CheckType,
  severity: Severity,
  industries: Industry[],
): RuleIssue[] {
  const active = entries.filter((e) => e.industry === null || industries.includes(e.industry));
  const issues: RuleIssue[] = [];
  for (const sentence of sentences) {
    for (const entry of active) {
      const m = sentence.match(toRegex(entry));
      if (!m) continue;
      issues.push({
        checkType,
        severity,
        originalText: sentence,
        match: m[0],
        reason: entry.reason,
        suggestion: entry.replacement ? sentence.replace(m[0], entry.replacement) : null,
      });
    }
  }
  return issues;
}

// L1의 질병·의약품 표현은 업종과 관계없이 식품·화장품 사전도 함께 적용한다
// (업종 추정이 틀려도 위험 표현을 놓치지 않도록)
function level1Industries(industries: Industry[]): Industry[] {
  return Array.from(new Set<Industry>([...industries, "food"]));
}

const PARTICLES = /(으로|에서|까지|부터|에게|처럼|보다|이랑|하고|은|는|이|가|을|를|에|의|도|로|와|과|만)$/;
const STOPWORDS = new Set(["그리고", "하지만", "그래서", "정말", "너무", "조금", "있는", "있었다", "있어요", "했다", "합니다", "입니다", "있습니다", "이번", "그냥", "제가", "저는"]);

export function keywordCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of text.match(/[가-힣A-Za-z0-9]{2,}/g) ?? []) {
    const word = raw.length > 2 ? raw.replace(PARTICLES, "") : raw;
    if (word.length < 2 || STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

function keywordIssues(text: string, sentences: string[]): RuleIssue[] {
  const counts = keywordCounts(text);
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const threshold = Math.max(6, Math.ceil(total * 0.03));
  const issues: RuleIssue[] = [];
  for (const [word, count] of counts) {
    if (count < threshold) continue;
    const sample = sentences.filter((s) => s.includes(word)).at(-1) ?? word;
    issues.push({
      checkType: "keyword",
      severity: "L3",
      originalText: sample,
      match: word,
      reason: `'${word}'이(가) ${count}회 반복됩니다. 일부를 다른 표현으로 바꾸거나 줄이세요.`,
      suggestion: null,
    });
  }
  return issues;
}

function repetitionIssues(sentences: string[]): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const neundeyo = sentences.filter((s) => /는데요[.!?]?$/.test(s));
  if (neundeyo.length > 3) {
    issues.push({
      checkType: "generic_phrase",
      severity: "info",
      originalText: neundeyo[3]!,
      match: "~는데요",
      reason: `'~는데요'로 끝나는 문장이 ${neundeyo.length}개입니다. 어미를 다양하게 바꾸세요.`,
      suggestion: null,
    });
  }
  // 같은 어미가 4문장 이상 연속
  let run = 1;
  for (let i = 1; i < sentences.length; i++) {
    const end = (s: string) => s.replace(/[.!?]+$/, "").slice(-3);
    run = end(sentences[i]!) === end(sentences[i - 1]!) ? run + 1 : 1;
    if (run === 4) {
      issues.push({
        checkType: "generic_phrase",
        severity: "info",
        originalText: sentences[i]!,
        match: end(sentences[i]!),
        reason: "같은 어미로 끝나는 문장이 4번 이상 이어집니다. 문장 길이와 어미에 변화를 주세요.",
        suggestion: null,
      });
    }
  }
  return issues;
}

function userWordIssues(sentences: string[], words: UserWord[]): RuleIssue[] {
  const issues: RuleIssue[] = [];
  for (const w of words) {
    const word = w.word.trim();
    if (!word) continue;
    for (const sentence of sentences) {
      if (!sentence.includes(word)) continue;
      issues.push({
        checkType: "forbidden",
        severity: "L4",
        originalText: sentence,
        match: word,
        reason: `내가 등록한 금칙어 '${word}'이(가) 들어 있습니다.`,
        suggestion: w.replacement !== null ? sentence.split(word).join(w.replacement) : null,
      });
    }
  }
  return issues;
}

function lengthIssue(label: string, value: number, limit: { max?: number; recommendedMax?: number; recommendedMin?: number; min?: number }, unit: string): RuleIssue | null {
  const base = { checkType: "length" as const, originalText: "", match: label, suggestion: null };
  if (limit.max !== undefined && value > limit.max) {
    return { ...base, severity: "L2", reason: `${label}이(가) ${value}${unit}로 플랫폼 최대치(${limit.max}${unit})를 넘습니다.` };
  }
  if (limit.min !== undefined && value < limit.min) {
    return { ...base, severity: "L2", reason: `${label}이(가) ${value}${unit}로 최소치(${limit.min}${unit})보다 짧습니다.` };
  }
  if (limit.recommendedMax !== undefined && value > limit.recommendedMax) {
    return { ...base, severity: "info", reason: `${label}이(가) ${value}${unit}입니다. 권장 범위(${limit.recommendedMax}${unit} 이하)로 줄이는 것을 제안합니다.` };
  }
  if (limit.recommendedMin !== undefined && value < limit.recommendedMin) {
    return { ...base, severity: "info", reason: `${label}이(가) ${value}${unit}입니다. 권장 분량(${limit.recommendedMin}${unit} 이상)보다 짧습니다.` };
  }
  return null;
}

function lengthIssues(input: RuleInput): RuleIssue[] {
  const r = platformRules;
  const chars = input.text.replace(/\s/g, "").length;
  const out: (RuleIssue | null)[] = [];
  switch (input.platform) {
    case "blog":
      if (input.title !== undefined) out.push(lengthIssue("제목", input.title.length, r.blog.title, "자"));
      out.push(lengthIssue("본문(공백 제외)", chars, r.blog.body, "자"));
      break;
    case "facebook":
      out.push(lengthIssue("본문(공백 제외)", chars, r.facebook.body, "자"));
      break;
    case "instagram":
      out.push(lengthIssue("캡션", input.text.length, r.instagram.caption, "자"));
      out.push(lengthIssue("해시태그", input.hashtags?.length ?? 0, r.instagram.hashtags, "개"));
      break;
    case "shorts":
      if (input.title !== undefined) out.push(lengthIssue("제목", input.title.length, r.shorts.title, "자"));
      if (input.durationSec !== undefined) out.push(lengthIssue("영상 길이", input.durationSec, r.shorts.durationSec, "초"));
      break;
  }
  return out.filter((i): i is RuleIssue => i !== null);
}

function disclosureIssues(input: RuleInput): RuleIssue[] {
  if (!input.hasSponsorship) return [];
  const haystack = `${input.title ?? ""}\n${input.text}\n${(input.hashtags ?? []).join(" ")}`;
  if (/광고|협찬|제공받아|제공 받아|유료 광고|#ad\b/i.test(haystack)) return [];
  return [
    {
      checkType: "disclosure",
      severity: "L1",
      originalText: "",
      match: "광고·협찬 표기",
      reason: "광고·협찬 콘텐츠로 선택했지만 표기 문구가 없습니다 (추천·보증 심사지침).",
      suggestion: SPONSORSHIP_DISCLOSURE,
    },
  ];
}

export function runRuleChecks(input: RuleInput): RuleIssue[] {
  const industries = input.industries ?? [];
  const sentences = splitSentences(input.title ? `${input.title}\n${input.text}` : input.text);
  const issues = [
    ...dictionaryIssues(sentences, LEVEL1, "forbidden", "L1", level1Industries(industries)),
    // Level 2 주의 표현은 대부분 과장·단정 표현이므로 과장 표현 항목으로 묶는다
    ...dictionaryIssues(sentences, LEVEL2, "claim", "L2", industries),
    ...dictionaryIssues(sentences, CLAIMS, "claim", "L2", industries),
    ...userWordIssues(sentences, input.userWords ?? []),
    ...dictionaryIssues(sentences, GENERIC_PHRASES, "generic_phrase", "info", industries),
    ...(input.platform === "blog" || input.platform === "facebook" ? keywordIssues(input.text, sentences) : []),
    ...repetitionIssues(sentences),
    ...lengthIssues(input),
    ...disclosureIssues(input),
  ];
  // 같은 문장·같은 표현 중복 제거
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.checkType}|${i.originalText}|${i.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 업종 추정 — 사용자 확인 전 후보 (명세서 41.2)
export function guessIndustries(text: string, category: string): Industry[] {
  const found = new Set<Industry>();
  for (const [industry, words] of Object.entries(INDUSTRY_KEYWORDS) as [Industry, string[]][]) {
    if (words.some((w) => text.includes(w))) found.add(industry);
  }
  if (category === "restaurant" || category === "cafe") found.add("food");
  return Array.from(found);
}
