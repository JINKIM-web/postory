// 품질 골든셋 평가 (계획서 6.2) — top-level await을 쓰므로 .mts
//   npm run eval                 기본 11건(카테고리별 1건 + 위험 표현 사례), 블로그만
//   npm run eval -- --all        24건 전체
//   npm run eval -- --ids cafe-1,cafe-2 --channels blog,instagram
//   npm run eval -- --mock       AI 호출 없이 흐름만 확인
// 실제 파이프라인(기억 정리 → 정보 확인 → 스토리 → 작성 → 품질 검토)을 그대로 돌리고,
// 파이프라인과 별개인 판정 AI가 "원래 입력만" 기준으로 결과 문장을 채점한다.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { channelText, runRuleChecks, splitSentences, type Industry } from "@postory/quality";
import { SPONSORSHIP_DISCLOSURE, type Category, type EvidenceItem, type Goal, type Platform, type ProjectContext, type Tone, type UsageInfo } from "@postory/shared";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (flag("mock")) process.env.POSTORY_MOCK = "1";

// config가 env를 읽은 뒤에 불러온다
const { isMock, config } = await import("../apps/api/src/config.js");
const { callJson } = await import("../apps/api/src/llm.js");
const { checkMissing, organizeMemory } = await import("../apps/api/src/stages/analyze.js");
const { composeStory } = await import("../apps/api/src/stages/story.js");
const { writeChannel } = await import("../apps/api/src/stages/write.js");
const { review } = await import("../apps/api/src/stages/review.js");

interface Case {
  id: string;
  category: Category;
  goal: Goal;
  tone: Tone;
  quickText: string;
  answers: string[];
  traps: string[];
  bait?: boolean;
  sponsorship?: boolean;
  industries?: string[];
}

const golden = JSON.parse(readFileSync(new URL("./golden-set.json", import.meta.url), "utf8")) as { cases: Case[] };
const ids = option("ids")?.split(",");
const cases = golden.cases.filter((c) => (ids ? ids.includes(c.id) : flag("all") ? true : c.id.endsWith("-1") || c.bait));
const channels = (option("channels")?.split(",") ?? ["blog"]) as Platform[];
const concurrency = Number(option("concurrency") ?? 3);

// 평가 기준 (계획서 6.2): MVP 출시 기준 근거 없는 문장 2% 이하, L1 잔존 0, 함정 0
const THRESHOLDS = { unsupportedRate: 0.02, m1UnsupportedRate: 0.05 };

// 입력에 없더라도 결과에 나오면 지어낸 것으로 보는 공통 함정
const COMMON_TRAPS = ["\\d{1,3}(,\\d{3})+\\s?원", "\\d+\\s?만\\s?원", "별점\\s?\\d", "평점\\s?\\d"];

const Judgement = z.object({
  sentences: z.array(
    z.object({
      no: z.number().int(),
      verdict: z.enum(["supported", "neutral", "embellished", "unsupported"]),
      reason: z.string(),
    }),
  ),
});

async function judge(c: Case, sentences: string[]) {
  return callJson({
    operation: "review",
    tier: "light",
    schemaName: "fact_judgement",
    schema: Judgement,
    system: `너는 사실 검증 채점자다. [사용자 입력]만을 근거로, 각 문장을 판정한다.
- supported: 입력(메모와 답변)에 있는 사실·의견을 그대로 또는 다른 말로 바꿔 말한 문장. 답변 내용(예: "방문 목적: 혼자 책 읽으러" → "혼자 책을 읽었다")도 근거다. 사용자 의견을 의견으로 표현한 문장 포함.
- neutral: 사실 주장이 없는 문장 — 소제목, 연결 문장, 입력 내용의 요약, 독자에게 하는 권유·제안·질문(CTA, 예: "~를 찾는다면 방문해 보세요", "댓글로 알려 주세요"), 글에 대한 메타 문장.
- embellished: 핵심 사실은 입력에 있지만 사소한 수식·묘사·느낌을 덧붙인 문장 (예: "한강을 뛰었다" → "한강을 따라 달렸다").
- unsupported: 입력에 없는 새로운 사실·경험·수치·속성·동기·평가를 만든 문장. 의견을 객관적 사실처럼 단정한 문장, 효능·순위·가격을 지어낸 문장 포함.
모든 문장 번호를 빠짐없이 판정한다.`,
    user: `[사용자 입력]\n메모: ${c.quickText}\n${c.answers.map((a) => `답변: ${a}`).join("\n") || "답변: 없음"}\n\n[판정할 문장]\n${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
    mock: () => ({ sentences: sentences.map((_, i) => ({ no: i + 1, verdict: "supported" as const, reason: "mock" })) }),
  });
}

interface ChannelResult {
  platform: Platform;
  sentences: number;
  chars: number;
  embellished: { text: string; reason: string }[];
  unsupported: { text: string; reason: string }[];
  trapHits: string[];
  l1Remaining: string[];
  lengthIssues: string[];
  autoFixed: number;
  openIssues: number;
  disclosureOk: boolean | null;
  excerpt: string;
}

interface CaseResult {
  id: string;
  ok: boolean;
  error?: string;
  seconds: number;
  costUsd: number;
  questions: number;
  channels: ChannelResult[];
}

async function runCase(c: Case): Promise<CaseResult> {
  const started = Date.now();
  const usage: UsageInfo[] = [];
  const base: ProjectContext = {
    quickText: c.quickText,
    category: c.category,
    goal: c.goal,
    tone: c.tone,
    platforms: channels,
    hasSponsorship: !!c.sponsorship,
    industries: c.industries ?? [],
  };
  try {
    const memory = await organizeMemory({ quickText: c.quickText, category: c.category, goal: c.goal });
    usage.push(...memory.usage);
    const ev = (content: string, isOpinion: boolean, sourceType: EvidenceItem["sourceType"], i: number): EvidenceItem => ({
      id: `${sourceType}-${i}`,
      type: "confirmed",
      content,
      sourceType,
      sourceRef: sourceType === "answer" ? `q${i}` : null,
      confidence: null,
      userVerified: true,
      isOpinion,
    });
    const evidence: EvidenceItem[] = [
      ...memory.confirmedFacts.map((f, i) => ev(f, false, "quick_text", i)),
      ...memory.userOpinions.map((f, i) => ev(f, true, "quick_text", 100 + i)),
      ...c.answers.map((a, i) => ev(a, /느낌|의향|좋았|만족|아쉬|배운/.test(a), "answer", i)),
    ];
    const missing = await checkMissing({ context: base, evidence: evidence.map((e) => ({ type: e.isOpinion ? "opinion" : e.type, content: e.content, confidence: null })), takenDates: [] });
    usage.push(...missing.usage);
    // 질문에는 답하지 않은 것으로 본다 (Unknown은 생략되어야 함)
    evidence.push(...missing.unknowns.map((u, i): EvidenceItem => ({ id: `u${i}`, type: "unknown", content: u, sourceType: null, sourceRef: null, confidence: null, userVerified: false, isOpinion: false })));
    const context: ProjectContext = { ...base, industries: Array.from(new Set([...(c.industries ?? []), ...missing.industries])) };

    const story = await composeStory({ context, evidence, photos: [] });
    usage.push(...story.usage);

    const results: ChannelResult[] = [];
    for (const platform of channels) {
      const written = await writeChannel({ platform, context, masterStory: story.masterStory, photos: [] });
      usage.push(...written.usage);
      const reviewed = await review({ platform, context, masterStory: story.masterStory, content: written.content });
      usage.push(...reviewed.usage);

      const ct = channelText(reviewed.content);
      const full = `${ct.title ?? ""}\n${ct.text}\n${(ct.hashtags ?? []).join(" ")}`;
      const sentences = splitSentences(ct.title ? `${ct.title}\n${ct.text}` : ct.text).filter((s) => s.length >= 6 && !s.includes(SPONSORSHIP_DISCLOSURE));
      const judged = await judge(c, sentences);
      usage.push(judged.usage);

      const input = `${c.quickText}\n${c.answers.join("\n")}`;
      const trapHits = [...c.traps, ...COMMON_TRAPS]
        .map((t) => new RegExp(t))
        .filter((re) => re.test(full) && !re.test(input))
        .map((re) => full.match(re)![0]);
      const rules = runRuleChecks({ ...ct, platform, industries: context.industries as Industry[], hasSponsorship: context.hasSponsorship });

      results.push({
        platform,
        sentences: sentences.length,
        chars: ct.text.replace(/s/g, "").length,
        embellished: judged.data.sentences.filter((s) => s.verdict === "embellished").map((s) => ({ text: sentences[s.no - 1] ?? "?", reason: s.reason })),
        unsupported: judged.data.sentences.filter((s) => s.verdict === "unsupported").map((s) => ({ text: sentences[s.no - 1] ?? "?", reason: s.reason })),
        trapHits: Array.from(new Set(trapHits)),
        l1Remaining: rules.filter((r) => r.severity === "L1").map((r) => r.match),
        lengthIssues: rules.filter((r) => r.checkType === "length" && r.severity !== "info").map((r) => r.reason),
        autoFixed: reviewed.issues.filter((i) => i.status === "auto_fixed").length,
        openIssues: reviewed.issues.filter((i) => i.status === "open" || i.status === "reverted").length,
        disclosureOk: context.hasSponsorship ? /광고|협찬|제공받아/.test(full) : null,
        excerpt: ct.text.slice(0, 160).replace(/\s+/g, " "),
      });
    }
    return { id: c.id, ok: true, seconds: (Date.now() - started) / 1000, costUsd: usage.reduce((n, u) => n + u.estimatedCostUsd, 0), questions: missing.questions.length, channels: results };
  } catch (err) {
    return { id: c.id, ok: false, error: err instanceof Error ? err.message : String(err), seconds: (Date.now() - started) / 1000, costUsd: usage.reduce((n, u) => n + u.estimatedCostUsd, 0), questions: 0, channels: [] };
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
        console.log(`  ${i + 1}/${items.length} ${items[i] && (items[i] as unknown as Case).id} 완료`);
      }
    }),
  );
  return out;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

console.log(`POSTORY 골든셋 평가 — ${cases.length}건 × [${channels.join(", ")}] · ${isMock() ? "Mock (점수는 의미 없음)" : `OpenAI ${config.modelLight} / ${config.modelMain}`}`);
const started = Date.now();
const results = await pool(cases, concurrency, runCase);

const done = results.filter((r) => r.ok);
const chs = done.flatMap((r) => r.channels);
const totalSentences = chs.reduce((n, c) => n + c.sentences, 0);
const totalUnsupported = chs.reduce((n, c) => n + c.unsupported.length, 0);
const rate = totalSentences ? totalUnsupported / totalSentences : 0;
const totalEmbellished = chs.reduce((n, c) => n + c.embellished.length, 0);
const avgChars = chs.reduce((n, c) => n + c.chars, 0) / Math.max(1, chs.length);
const trapTotal = chs.reduce((n, c) => n + c.trapHits.length, 0);
const l1Total = chs.reduce((n, c) => n + c.l1Remaining.length, 0);
const disclosureFails = chs.filter((c) => c.disclosureOk === false).length;
const cost = results.reduce((n, r) => n + r.costUsd, 0);
const avgSec = done.reduce((n, r) => n + r.seconds, 0) / Math.max(1, done.length);

const verdict = (ok: boolean) => (ok ? "통과" : "미달");
const lines: string[] = [
  `# 골든셋 평가 결과 — ${new Date().toLocaleString("ko-KR")}`,
  "",
  `- 모드: ${isMock() ? "Mock (AI 호출 없음 — 점수는 의미 없음)" : `OpenAI (${config.modelLight} / ${config.modelMain})`}`,
  `- 대상: ${cases.length}건 × ${channels.join(", ")} · 실패 ${results.length - done.length}건`,
  `- 평균 본문 길이: ${avgChars.toFixed(0)}자 (공백 제외)`,
  `- 총 소요: ${((Date.now() - started) / 1000).toFixed(0)}초 (건당 평균 ${avgSec.toFixed(0)}초) · 추정 비용 $${cost.toFixed(3)} (건당 $${(cost / Math.max(1, results.length)).toFixed(3)}, 판정 AI 포함)`,
  "",
  "| 지표 | 결과 | 기준 | 판정 |",
  "|---|---|---|---|",
  `| 근거 없는 문장 비율 | ${pct(rate)} (${totalUnsupported}/${totalSentences}) | M1 ≤ 5% · 출시 ≤ 2% | M1 ${verdict(rate <= THRESHOLDS.m1UnsupportedRate)} · 출시 ${verdict(rate <= THRESHOLDS.unsupportedRate)} |`,
  `| 사소한 꾸밈 (참고) | ${pct(totalSentences ? totalEmbellished / totalSentences : 0)} (${totalEmbellished}/${totalSentences}) | — | 참고 |`,
  `| 함정 표현(지어낸 가격·시간 등) | ${trapTotal}건 | 0건 | ${verdict(trapTotal === 0)} |`,
  `| L1 금칙어 잔존 | ${l1Total}건 | 0건 | ${verdict(l1Total === 0)} |`,
  `| 광고·협찬 표기 누락 | ${disclosureFails}건 | 0건 | ${verdict(disclosureFails === 0)} |`,
  "",
  "> 근거 판정은 AI 채점이므로 수동 검수를 함께 해야 합니다. 아래 '근거 없음' 문장을 직접 확인해 주세요.",
  "",
  "## 사례별",
  "",
  "| 사례 | 채널 | 글자 | 문장 | 근거 없음 | 꾸밈 | 함정 | L1 | 자동 수정 | 열린 이슈 | 질문 | 시간 | 비용 |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
];
for (const r of results) {
  if (!r.ok) {
    lines.push(`| ${r.id} | — | | 실패: ${r.error?.slice(0, 80)} | | | | | | | | ${r.seconds.toFixed(0)}s | $${r.costUsd.toFixed(3)} |`);
    continue;
  }
  for (const c of r.channels) {
    lines.push(
      `| ${r.id} | ${c.platform} | ${c.chars} | ${c.sentences} | ${c.unsupported.length} | ${c.embellished.length} | ${c.trapHits.join(", ") || 0} | ${c.l1Remaining.join(", ") || 0} | ${c.autoFixed} | ${c.openIssues} | ${r.questions} | ${r.seconds.toFixed(0)}s | $${r.costUsd.toFixed(3)} |`,
    );
  }
}
lines.push("", "## 근거 없음으로 판정된 문장", "");
for (const r of done) for (const c of r.channels) for (const u of c.unsupported) lines.push(`- **${r.id}/${c.platform}** "${u.text}" — ${u.reason}`);
if (!totalUnsupported) lines.push("- 없음");

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const dir = new URL("./results/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${stamp}.md`, dir), lines.join("\n"));
writeFileSync(new URL(`${stamp}.json`, dir), JSON.stringify({ cases: cases.map((c) => c.id), channels, results }, null, 2));
console.log(`\n${lines.slice(0, 15).join("\n")}\n\n전체 보고서: eval/results/${stamp}.md`);
