import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { PIPELINE_STAGES } from "@postory/shared";
import { Button, Card, cx, Notice, Spinner } from "../components/ui";
import { useLive } from "../lib/hooks";
import { runAnalyze, runGenerate } from "../lib/pipeline";
import { getProject, listEvidence } from "../lib/repo";

// AI 처리 단계 화면 (벤치마크 11장) — 스피너만 보여주지 않고 단계와 추출된 근거를 보여준다.

// StrictMode에서 두 번 실행되지 않도록 프로젝트별 실행 상태를 모듈에 둔다
const running = new Map<string, Promise<unknown>>();

export function ProcessingPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const phase = params.get("phase") === "generate" ? "generate" : "analyze";
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const { data } = useLive(async () => ({ project: await getProject(id), evidence: await listEvidence(id) }), [id], ["projects", "evidence"]);

  const run = useCallback(async () => {
    setFailed(false);
    const key = `${id}:${phase}`;
    let job = running.get(key);
    if (!job) {
      job = (async () => {
        if (phase === "analyze") {
          const next = await runAnalyze(id);
          if (next === "questions") return "questions";
        }
        await runGenerate(id);
        return "editor";
      })().finally(() => running.delete(key));
      running.set(key, job);
    }
    try {
      const next = await job;
      navigate(next === "questions" ? `/projects/${id}/questions` : `/projects/${id}/editor`, { replace: true });
    } catch {
      setFailed(true);
    }
  }, [id, phase, navigate]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  if (!data) return <Spinner className="mx-auto mt-20" />;
  const project = data.project;
  if (!project) return <Notice tone="alert">프로젝트를 찾을 수 없습니다.</Notice>;

  const facts = data.evidence.filter((e) => e.type === "confirmed" || (e.type === "visual" && e.confidence === "high")).slice(0, 8);
  const currentIdx = PIPELINE_STAGES.findIndex((s) => project.stages[s.value] !== "done");

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="text-[28px] font-bold">{failed ? "생성이 멈췄습니다" : "스토리를 만들고 있어요"}</h1>
      <p className="mt-1 text-muted">사진과 메모에서 확인할 수 있는 정보만 모아 글을 씁니다.</p>

      <Card className="mt-6 p-5 sm:p-6">
        <ol className="grid gap-3 sm:grid-cols-6 sm:gap-2" aria-label="생성 단계">
          {PIPELINE_STAGES.map((s, i) => {
            const status = project.stages[s.value] ?? "pending";
            const isCurrent = i === currentIdx && status !== "failed";
            return (
              <li key={s.value} className="flex items-center gap-3 sm:flex-col sm:text-center">
                <span
                  className={cx(
                    "grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold",
                    status === "done" && "border-confirmed bg-confirmed text-white",
                    status === "failed" && "border-alert bg-alert-soft text-alert",
                    status === "running" && "pulse-soft border-accent bg-accent-tint text-accent-text",
                    status === "pending" && (isCurrent ? "border-accent text-accent-text" : "border-line text-muted"),
                  )}
                  aria-hidden
                >
                  {status === "done" ? <Check className="size-4" /> : status === "failed" ? "!" : i + 1}
                </span>
                <span className={cx("text-sm", status === "running" ? "font-semibold text-ink" : status === "done" ? "text-ink-2" : "text-muted")}>
                  {s.label}
                  <span className="sr-only">
                    {" "}
                    — {status === "done" ? "완료" : status === "running" ? "진행 중" : status === "failed" ? "실패" : "대기"}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        {facts.length > 0 && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-2 text-xs font-semibold text-muted">찾아낸 근거</p>
            <div className="flex flex-wrap gap-2">
              {facts.map((f) => (
                <span key={f.id} className={cx("rounded-full px-3 py-1 text-[13px]", f.type === "visual" ? "bg-visual-soft text-visual" : "bg-confirmed-soft text-confirmed")}>
                  {f.content}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {failed && project.stageError && (
        <Notice tone="alert" icon={<TriangleAlert className="size-4" />} className="mt-4" title={`'${PIPELINE_STAGES.find((s) => s.value === project.stageError!.stage)?.label}' 단계에서 문제가 생겼습니다`}>
          <p>{project.stageError.message}</p>
          <p className="mt-1 text-xs">앞 단계 결과는 저장되어 있어 이 단계부터 다시 시작합니다.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" icon={<RefreshCw className="size-4" />} onClick={() => run()}>
              다시 시도
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${id}/setup`)}>
              입력으로 돌아가기
            </Button>
          </div>
        </Notice>
      )}
    </div>
  );
}
