import { z } from "zod";
import { channelText, insertDisclosure, replaceSentence, runRuleChecks, splitSentences, type Industry, type RuleIssue } from "@postory/quality";
import { SPONSORSHIP_DISCLOSURE, type ChannelContent, type CheckType, type ReviewIssue, type ReviewRequest, type ReviewResponse, type Severity, type UsageInfo, type UserWord } from "@postory/shared";
import { callJson } from "../llm.js";
import { EVIDENCE_POLICY, storyBlock, STYLE_POLICY, toneTarget } from "../prompts.js";

// 6단계: Content Quality Engine (명세서 10.1)
// ① 규칙 점검(코드) → ② 문맥 검토(LLM 1회) → ③ 문제 문장만 재작성(LLM 1회) → ④ 재검증(코드)

const ContextualReview = z.object({
  issues: z.array(
    z.object({
      sentenceNo: z.number().int(),
      checkType: z.enum(["evidence", "claim", "forbidden", "tone", "generic_phrase"]),
      severity: z.enum(["L1", "L2", "info"]),
      reason: z.string(),
    }),
  ),
  // 문맥상 문제없는 L2 표현의 번호
  acceptableL2: z.array(z.number().int()),
  searchChecklist: z.array(z.object({ item: z.string(), pass: z.boolean(), suggestion: z.string() })),
});

const Rewrites = z.object({
  rewrites: z.array(z.object({ id: z.number().int(), rewritten: z.string() })),
});

const REWRITABLE: CheckType[] = ["forbidden", "claim", "evidence", "generic_phrase", "tone"];
// 사용자 확인 없이 바로 고치는 이슈 (명세서 10.1 ③): 절대 금지 표현과 근거 없는 사실
const autoFix = (i: { severity: Severity; checkType: CheckType }) => i.severity === "L1" || i.checkType === "evidence";

interface Draft {
  checkType: CheckType;
  severity: Severity;
  originalText: string;
  reason: string;
  suggestion: string | null;
}

// 시스템이 넣은 광고·협찬 표기 문장은 검토·재작성 대상이 아니다 (Master Story 근거가 아닌 법적 표기)
const isDisclosure = (s: string) => s.includes(SPONSORSHIP_DISCLOSURE);

function numbersIn(s: string): string[] {
  return s.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

// ④ 재작성 문장 검증: 새 위험 표현이 생기거나, 근거에 없는 숫자가 생기면 실패
function verifyRewrite(original: string, rewritten: string, evidenceText: string, industries: Industry[], userWords: UserWord[]): boolean {
  if (rewritten === "") return true;
  const issues = runRuleChecks({ platform: "facebook", text: rewritten, industries, userWords });
  if (issues.some((i) => i.severity === "L1" || i.severity === "L4" || i.checkType === "claim" || (i.checkType === "forbidden" && i.severity === "L2"))) return false;
  const allowed = new Set([...numbersIn(original), ...numbersIn(evidenceText)]);
  return numbersIn(rewritten).every((n) => allowed.has(n));
}

export async function review(req: ReviewRequest): Promise<ReviewResponse> {
  const { platform, context, masterStory: story } = req;
  const industries = context.industries as Industry[];
  const usage: UsageInfo[] = [];
  const ct = channelText(req.content);

  // ① 규칙 기반 점검
  const userWords = context.personalization?.userWords ?? [];
  const ruleIssues: RuleIssue[] = runRuleChecks({ ...ct, platform, industries, hasSponsorship: context.hasSponsorship, userWords });

  // ② 문맥 검토
  const sentences = splitSentences(ct.title ? `${ct.title}\n${ct.text}` : ct.text)
    .filter((s) => !isDisclosure(s))
    .slice(0, 150);
  const l2Hits = ruleIssues
    .map((issue, idx) => ({ issue, idx }))
    .filter(({ issue }) => issue.severity === "L2" && (issue.checkType === "forbidden" || issue.checkType === "claim"));

  const reviewed = await callJson({
    operation: "review",
    tier: "light",
    schemaName: "contextual_review",
    schema: ContextualReview,
    system: `너는 콘텐츠 품질 검수자다. 문장마다 다음을 점검하고 문제 있는 문장만 보고한다.
- evidence: Master Story 근거에 없는 사실·경험·수치를 쓴 문장 (가장 중요). 의견을 사실처럼 단정한 문장도 포함. 이런 문장은 severity L1.
- claim: 근거 없는 최상급·효능·인증·순위·가격 비교. severity L2.
- forbidden: 질병 치료·수익 보장 등 금지 표현. severity L1.
- tone: ${toneTarget(context)}과 크게 어긋나는 문장. severity info.
- generic_phrase: 구체성 없는 AI 상투 표현. severity info.
acceptableL2: 아래 '주의 표현 목록' 중 문맥상 문제없는 항목 번호 (예: 부정문 "절대 과장하지 않았다").
${platform === "blog" ? "searchChecklist: '검색 의도 적합성', '제목 적합성', '키워드 자연스러움', '정보 구체성' 4개 항목을 통과/개선 필요로 판정하고, 개선이 필요하면 suggestion에 한 문장 제안(근거 없는 정보를 추가하라는 제안은 하지 말 것, 부족한 정보는 '~ 정보가 없습니다'로 알릴 것)." : "searchChecklist는 빈 배열."}`,
    user: `${storyBlock(story)}\n\n[검수 대상 문장]\n${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n[주의 표현 목록]\n${l2Hits.map((h, i) => `${i + 1}. "${h.issue.match}" — ${h.issue.originalText}`).join("\n") || "(없음)"}`,
    mock: () => ({ issues: [], acceptableL2: [], searchChecklist: [] }),
  });
  usage.push(reviewed.usage);

  const acceptable = new Set(reviewed.data.acceptableL2.map((n) => l2Hits[n - 1]?.idx).filter((n): n is number => n !== undefined));
  const drafts: Draft[] = ruleIssues
    .filter((issue, idx) => !acceptable.has(idx) && !isDisclosure(issue.originalText))
    .map((i) => ({ checkType: i.checkType, severity: i.severity, originalText: i.originalText, reason: i.reason, suggestion: i.suggestion }));

  for (const issue of reviewed.data.issues) {
    const sentence = sentences[issue.sentenceNo - 1];
    if (!sentence) continue;
    if (drafts.some((d) => d.originalText === sentence && d.checkType === issue.checkType)) continue;
    drafts.push({ checkType: issue.checkType, severity: issue.severity, originalText: sentence, reason: issue.reason, suggestion: null });
  }
  for (const item of reviewed.data.searchChecklist) {
    if (item.pass) continue;
    drafts.push({ checkType: "search", severity: "info", originalText: "", reason: `${item.item}: ${item.suggestion}`, suggestion: null });
  }

  // ③ 문제 문장만 재작성
  const targets = drafts
    .map((d, id) => ({ d, id }))
    .filter(({ d }) => d.originalText && d.suggestion === null && REWRITABLE.includes(d.checkType));

  const evidenceText = storyBlock(story);
  const rewrites = new Map<number, string>();
  if (targets.length) {
    const rewritten = await callJson({
      operation: "rewrite",
      tier: "main",
      schemaName: "targeted_rewrite",
      schema: Rewrites,
      system: `너는 문제가 있는 문장만 고치는 교정자다. 각 문장의 문제를 해결하되 앞뒤 문맥과 ${toneTarget(context)}을 유지한다.
${EVIDENCE_POLICY}
${STYLE_POLICY}
- 근거가 없어 고칠 수 없는 문장은 rewritten을 빈 문자열("")로 하여 삭제한다.
- 문장 하나는 문장 하나로만 고친다. 새 정보를 추가하지 않는다.`,
      user: `${evidenceText}\n\n[고칠 문장]\n${targets.map(({ d, id }) => `${id}. "${d.originalText}" — 문제: ${d.reason}`).join("\n")}`,
      mock: () => ({
        rewrites: targets.map(({ d, id }) => ({ id, rewritten: autoFix(d) ? "" : d.originalText })),
      }),
    });
    usage.push(rewritten.usage);
    for (const r of rewritten.data.rewrites) rewrites.set(r.id, r.rewritten.trim());
  }

  // ④ 재검증 후 적용
  let content: ChannelContent = req.content;
  const issues: ReviewIssue[] = [];
  // 한 문장에 이슈가 여러 개일 수 있다. 자동 수정을 먼저 적용하고,
  // 이미 고친 문장에 걸린 나머지 이슈는 같은 수정으로 해결된 것으로 본다.
  const fixedSentences = new Map<string, string>();
  const order = drafts.map((d, id) => ({ d, id })).sort((a, b) => Number(autoFix(b.d)) - Number(autoFix(a.d)));
  order.forEach(({ d, id }) => {
    if (d.originalText && fixedSentences.has(d.originalText)) {
      issues.push({ ...d, suggestion: fixedSentences.get(d.originalText)!, status: "auto_fixed" });
      return;
    }
    if (d.checkType === "disclosure") {
      content = insertDisclosure(content);
      issues.push({ ...d, status: "auto_fixed" });
      return;
    }
    let suggestion = d.suggestion;
    const proposed = rewrites.get(id);
    if (proposed !== undefined && proposed !== d.originalText) {
      suggestion = verifyRewrite(d.originalText, proposed, evidenceText, industries, userWords) ? proposed : null;
      if (suggestion === null && autoFix(d)) {
        // L1은 남겨 두면 안 되므로 문장을 지운다. 근거 문제는 원문을 두고 사용자에게 확인을 맡긴다
        if (d.severity === "L1" && d.checkType !== "evidence") {
          const deleted = replaceSentence(content, d.originalText, "");
          if (deleted) {
            content = deleted;
            fixedSentences.set(d.originalText, "");
            issues.push({ ...d, suggestion: "", status: "auto_fixed", reason: `${d.reason} (안전한 수정문을 만들지 못해 문장을 삭제했습니다.)` });
            return;
          }
        }
        issues.push({ ...d, suggestion: null, status: "reverted", reason: `${d.reason} (자동 수정 결과가 검증을 통과하지 못해 원문을 유지했습니다. 직접 확인해 주세요.)` });
        return;
      }
    }
    if (autoFix(d) && suggestion !== null) {
      const next = replaceSentence(content, d.originalText, suggestion);
      if (next) {
        content = next;
        fixedSentences.set(d.originalText, suggestion);
        issues.push({ ...d, suggestion, status: "auto_fixed" });
        return;
      }
    }
    issues.push({ ...d, suggestion, status: "open" });
  });

  // 안전장치: 수정 과정에서 표기 문구가 빠졌다면 다시 넣는다
  if (context.hasSponsorship) {
    const after = channelText(content);
    if (runRuleChecks({ ...after, platform, hasSponsorship: true }).some((i) => i.checkType === "disclosure")) content = insertDisclosure(content);
  }

  return { content, issues, usage };
}
