import { Database, Gauge, HelpCircle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BackupControls } from "../components/BackupControls";
import { Button, Card, Notice, useToast } from "../components/ui";
import { api } from "../lib/api";
import { getDb } from "../lib/db";
import { useLive } from "../lib/hooks";
import { clearAllData } from "../lib/repo";
import { setSettings, useSettings } from "../lib/settings";
import { metrics } from "../lib/usage";

// 설정: 사용량 한도, 품질 지표(명세서 39장), 로컬 데이터 관리, 도움말

function NumberField({ label, value, onChange, min = 1, max = 1000, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-ink-2">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
          className="h-10 w-24 rounded-[10px] border border-line px-3 text-right outline-none focus:border-accent"
        />
        {suffix && <span className="w-6 text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

export function SettingsPage() {
  const s = useSettings();
  const toast = useToast();
  const [storage, setStorage] = useState<string | null>(null);
  const [mode, setMode] = useState<string>("확인 중");

  const { data: m } = useLive(
    async () => {
      const questions = await (await getDb()).getAll("questions");
      const answered = questions.filter((q) => q.answer !== null || q.skipped);
      return metrics({ total: answered.length, skipped: answered.filter((q) => q.skipped).length });
    },
    [s.copyReadyThreshold],
    ["events", "usage", "questions"],
  );

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setStorage(`${((e.usage ?? 0) / 1024 / 1024).toFixed(1)}MB 사용 중`))
      .catch(() => undefined);
    api
      .health()
      .then((h) => setMode(h.mode === "openai" ? "OpenAI 연결됨" : "데모 모드 (OPENAI_API_KEY 없음)"))
      .catch(() => setMode("AI 서버에 연결할 수 없음"));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-[28px] font-bold">설정</h1>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <Gauge className="size-5 text-accent" aria-hidden /> 품질 지표
        </h2>
        <p className="mb-4 text-sm text-muted">이 브라우저에서 만든 콘텐츠 기준입니다 (명세서 39장).</p>
        {m && (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Copy-ready Rate", pct(m.copyReadyRate), `편집 거리 ${Math.round(s.copyReadyThreshold * 100)}% 이하로 복사 ${m.copyReadyContents} / 생성 ${m.generatedContents}`],
              ["복사한 콘텐츠", `${m.copiedContents}개`, "채널별 첫 복사 기준"],
              ["질문 건너뛰기", pct(m.questionSkipRate), "Smart Question"],
              ["섹션 재작성", `${m.sectionRegenerations}회`, "재생성 비율 참고"],
              ["생성 1건당 비용", m.avgCostPerGeneration === null ? "—" : `$${m.avgCostPerGeneration.toFixed(3)}`, "UsageLog 추정치"],
              ["누적 추정 비용", `$${m.totalCost.toFixed(3)}`, mode],
            ].map(([k, v, d]) => (
              <div key={k} className="rounded-[10px] bg-canvas-alt p-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-1 text-xl font-bold text-ink">{v}</dd>
                <dd className="mt-0.5 text-[11px] text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        )}
        {m && m.avgCostPerGeneration !== null && m.avgCostPerGeneration > s.costAlertUsd && (
          <Notice tone="warning" className="mt-4">
            생성 1건당 평균 비용이 경고 기준(${s.costAlertUsd})을 넘었습니다.
          </Notice>
        )}
      </Card>

      <Card className="divide-y divide-line p-5 sm:p-6">
        <h2 className="pb-2 text-lg font-semibold">사용량 한도와 기준</h2>
        <NumberField label="월 생성 한도" value={s.monthlyGenerationLimit} onChange={(n) => setSettings({ monthlyGenerationLimit: n })} suffix="개" />
        <NumberField label="일 생성 한도" value={s.dailyGenerationLimit} onChange={(n) => setSettings({ dailyGenerationLimit: n })} suffix="개" />
        <NumberField label="월 재작성·재생성 한도" value={s.monthlyRewriteLimit} onChange={(n) => setSettings({ monthlyRewriteLimit: n })} suffix="회" />
        <NumberField label="생성 1건당 비용 경고 기준" value={s.costAlertUsd} min={0.01} max={10} step={0.01} onChange={(n) => setSettings({ costAlertUsd: n })} suffix="$" />
        <NumberField label="Copy-ready 편집 거리 기준" value={Math.round(s.copyReadyThreshold * 100)} min={1} max={50} onChange={(n) => setSettings({ copyReadyThreshold: n / 100 })} suffix="%" />
        <label className="flex items-center justify-between gap-4 py-3 text-sm">
          <span className="text-ink-2">
            Publish Readiness 점수 보이기
            <span className="block text-xs text-muted">끄면 통과/개선 제안만 보여줍니다 (명세서 14장)</span>
          </span>
          <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={s.showReadinessScore} onChange={(e) => setSettings({ showReadinessScore: e.target.checked })} />
        </label>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <Database className="size-5 text-accent" aria-hidden /> 로컬 데이터
        </h2>
        <p className="text-sm text-muted">
          프로젝트·사진·버전·로그는 이 브라우저의 IndexedDB에, 설정은 localStorage에 저장됩니다. 다른 기기나 브라우저와 공유되지 않으며, 브라우저 데이터를 지우면 함께 삭제됩니다.
          {storage && ` (${storage})`}
        </p>
        <div className="mt-4 border-t border-line pt-4">
          <BackupControls />
        </div>
        <Button
          variant="danger"
          size="sm"
          className="mt-4"
          icon={<Trash2 className="size-4" />}
          onClick={async () => {
            if (!window.confirm("모든 프로젝트, 사진, 버전 기록, 로그를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?")) return;
            await clearAllData();
            toast("모든 데이터를 삭제했습니다.");
          }}
        >
          모든 데이터 삭제
        </Button>
      </Card>

      <Card className="p-5 sm:p-6" >
        <h2 id="help" className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <HelpCircle className="size-5 text-accent" aria-hidden /> 도움말
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
          <li>사진(최대 10장)과 짧은 메모를 넣고 카테고리·목적·톤·채널을 고릅니다.</li>
          <li>AI가 사진과 메모에서 확인되는 사실만 뽑고, 부족한 정보는 최대 4개까지 질문합니다. 모르면 건너뛰세요 — 지어내지 않고 생략합니다.</li>
          <li>하나의 Master Story로 정리한 뒤 선택한 채널별 콘텐츠를 만들고, 금칙어·과장 표현·근거 없는 문장을 검사합니다.</li>
          <li>편집기에서 고치고, 섹션별로 다시 쓰거나 이전 버전으로 되돌릴 수 있습니다.</li>
          <li>
            네이버 블로그: <strong>네이버 블로그용 복사</strong>로 본문을 붙여넣고, <strong>이미지 ZIP</strong>의 번호대로 [사진 N 삽입] 자리에 사진을 올리세요.
          </li>
          <li>직접 게시한 뒤 <strong>게시 완료 표시</strong>를 눌러 상태를 관리합니다.</li>
        </ol>
      </Card>
    </div>
  );
}
