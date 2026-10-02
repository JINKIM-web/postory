import { ArrowRight, CalendarCheck, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { INDUSTRY_LABELS, type Industry } from "@postory/quality";
import { Button, Card, Chip, Notice, Spinner } from "../components/ui";
import { useLive } from "../lib/hooks";
import { answerQuestion } from "../lib/pipeline";
import { getProject, listQuestions, updateProject } from "../lib/repo";
import type { QuestionRecord } from "../lib/types";

// Smart Question (명세서 7.3, 벤치마크 12장) — 한 번에 한 질문, 선택형 우선, 건너뛰기 가능

function QuestionCard({ q, index, total, onDone }: { q: QuestionRecord; index: number; total: number; onDone: () => void }) {
  const [text, setText] = useState("");
  const [direct, setDirect] = useState(q.answerType === "text");
  const [busy, setBusy] = useState(false);

  async function submit(answer: string | null) {
    setBusy(true);
    await answerQuestion(q, answer);
    setBusy(false);
    setText("");
    onDone();
  }

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-accent-text">
          {index + 1} / {total}
        </span>
        {q.answerType === "date_confirm" && (
          <span className="inline-flex items-center gap-1 text-xs text-meta">
            <CalendarCheck className="size-3.5" aria-hidden /> 사진 촬영일 확인
          </span>
        )}
      </div>
      <h2 className="mt-3 text-xl font-semibold leading-snug sm:text-[22px]">{q.question}</h2>

      {q.options.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {q.options.map((o) => (
            <Chip key={o} disabled={busy} onClick={() => submit(o)}>
              {o}
            </Chip>
          ))}
        </div>
      )}

      {q.answerType !== "date_confirm" && (
        <div className="mt-4">
          {!direct ? (
            <button type="button" className="text-sm font-medium text-ink-2 underline underline-offset-4" onClick={() => setDirect(true)}>
              직접 입력
            </button>
          ) : (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) void submit(text.trim());
              }}
            >
              <input
                autoFocus
                value={text}
                maxLength={300}
                onChange={(e) => setText(e.target.value)}
                placeholder="짧게 적어 주세요"
                className="h-12 flex-1 rounded-[10px] border border-line px-3 text-[15px] outline-none focus:border-accent"
                aria-label="답변"
              />
              <Button type="submit" variant="primary" disabled={!text.trim()} loading={busy}>
                답변
              </Button>
            </form>
          )}
        </div>
      )}

      <div className="mt-6 border-t border-line pt-4">
        <button type="button" className="text-sm text-muted hover:text-ink" disabled={busy} onClick={() => submit(null)}>
          건너뛰기 — 이 정보는 글에서 생략합니다
        </button>
      </div>
    </Card>
  );
}

export function QuestionsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data } = useLive(async () => ({ project: await getProject(id), questions: await listQuestions(id) }), [id], ["projects", "questions"]);
  const [industries, setIndustries] = useState<string[] | null>(null);

  if (!data) return <Spinner className="mx-auto mt-20" />;
  const { project, questions } = data;
  if (!project) return <Notice tone="alert">프로젝트를 찾을 수 없습니다.</Notice>;

  const pending = questions.filter((q) => q.answer === null && !q.skipped);
  const current = pending[0];
  const selected = industries ?? project.industries;
  const needsIndustry = !project.industriesConfirmed && project.industries.length > 0;

  async function proceed() {
    await updateProject(id, { industries: selected, industriesConfirmed: true });
    navigate(`/projects/${id}/processing?phase=generate`, { replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="text-[26px] font-bold leading-snug sm:text-[28px]">조금만 더 알려주면 글이 더 자연스러워져요</h1>
      <p className="mt-1 text-muted">모르는 내용은 건너뛰어도 됩니다. AI가 대신 지어내지 않고 생략합니다.</p>

      <div className="mt-6 space-y-4">
        {current ? (
          <QuestionCard key={current.id} q={current} index={questions.indexOf(current)} total={questions.length} onDone={() => undefined} />
        ) : (
          <>
            {needsIndustry && (
              <Card className="p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-unknown" aria-hidden />
                  <h2 className="text-lg font-semibold">업종을 확인해 주세요</h2>
                </div>
                <p className="mt-1 text-sm text-muted">해당 업종의 광고 표현 규제(질병 효능, 수익 보장 등)를 점검 사전에 추가로 적용합니다. 맞는 업종만 선택하세요.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(INDUSTRY_LABELS) as Industry[]).map((ind) => (
                    <Chip key={ind} selected={selected.includes(ind)} onClick={() => setIndustries(selected.includes(ind) ? selected.filter((x) => x !== ind) : [...selected, ind])}>
                      {INDUSTRY_LABELS[ind]}
                    </Chip>
                  ))}
                </div>
              </Card>
            )}
            <Card className="p-5 sm:p-6">
              <p className="font-semibold text-ink">{questions.length ? "답변해 주셔서 고마워요." : "추가로 확인할 내용이 없어요."}</p>
              <p className="mt-1 text-sm text-muted">이제 하나의 Master Story로 정리한 뒤 선택한 채널별 콘텐츠를 만듭니다.</p>
              <Button variant="primary" size="lg" className="mt-5 w-full sm:w-auto" icon={<ArrowRight className="size-4" />} onClick={proceed}>
                콘텐츠 만들기
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
