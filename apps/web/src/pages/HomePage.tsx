import { ArrowRight, ChevronRight, DatabaseBackup, Download, ImagePlus, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CATEGORIES, PLATFORMS, type Category, type Platform, type Tone } from "@postory/shared";
import { addFiles } from "../components/PhotoUploader";
import { ProjectCard } from "../components/ProjectCard";
import { Button, Card, Chip, cx, EmptyState, Notice, Spinner, useToast } from "../components/ui";
import { useLive } from "../lib/hooks";
import { createProject, listImages, listProjects } from "../lib/repo";
import { getSettings } from "../lib/settings";
import { usageSnapshot } from "../lib/usage";
import { downloadFullBackup } from "../components/BackupControls";
import { useSettings } from "../lib/settings";

// 홈 대시보드 (벤치마크 9장 / Stitch postory_1)

export async function newProjectWithDefaults(init: { quickText?: string; category?: Category | null } = {}) {
  const s = getSettings();
  const platforms = (s.lastPlatforms?.filter((p) => PLATFORMS.some((x) => x.value === p)) as Platform[] | undefined) ?? ["blog"];
  return createProject({ tone: (s.lastTone as Tone | null) ?? "plain", platforms: platforms.length ? platforms : ["blog"], quickText: init.quickText ?? "", category: init.category ?? null });
}

function QuickCreate() {
  const navigate = useNavigate();
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const previews = files.slice(0, 4).map((f) => URL.createObjectURL(f));

  async function start() {
    setBusy(true);
    try {
      const project = await newProjectWithDefaults({ quickText: memo.trim(), category });
      const { errors } = await addFiles(project.id, files, 0);
      for (const e of errors) toast(e, "alert");
      navigate(`/projects/${project.id}/setup`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="size-5 text-accent" aria-hidden />
        <h2 className="text-lg font-semibold">빠르게 시작하기</h2>
        <span className="hidden text-sm text-muted sm:inline">사진과 메모만 넣고 다음 화면에서 채널을 고르세요</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div
          className="flex min-h-[170px] flex-col rounded-[10px] border border-dashed border-line-strong bg-canvas-alt p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)].slice(0, 10));
          }}
        >
          {files.length ? (
            <div className="grid flex-1 grid-cols-4 gap-2">
              {previews.map((src, i) => (
                <img key={i} src={src} alt="" className="aspect-square w-full rounded-md object-cover" onLoad={() => URL.revokeObjectURL(src)} />
              ))}
            </div>
          ) : (
            <button type="button" className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-ink-2" onClick={() => input.current?.click()}>
              <ImagePlus className="size-6 text-accent" aria-hidden />
              사진을 끌어다 놓거나 눌러서 선택
            </button>
          )}
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>{files.length ? `${files.length}장 선택됨` : "JPG, PNG, WEBP, HEIC"}</span>
            {files.length > 0 && (
              <button type="button" className="underline" onClick={() => input.current?.click()}>
                더 추가
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            hidden
            onChange={(e) => {
              setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 10));
              e.target.value = "";
            }}
          />
        </div>
        <div className="flex flex-col gap-3">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="생각나는 키워드나 메모 — 길게 쓰지 않아도 됩니다"
            className="w-full flex-1 resize-none rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-accent"
            aria-label="메모"
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.slice(0, 6).map((c) => (
              <Chip key={c.value} selected={category === c.value} onClick={() => setCategory(category === c.value ? null : (c.value as Category))} className="min-h-9 px-3 text-[13px]">
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" loading={busy} icon={<ArrowRight className="size-4" />} onClick={start}>
          콘텐츠 만들기
        </Button>
      </div>
    </Card>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { lastBackupAt } = useSettings();
  const { data } = useLive(
    async () => {
      const projects = (await listProjects()).slice(0, 4);
      const covers = await Promise.all(projects.map(async (p) => (await listImages(p.id))[0]));
      return { projects, covers, usage: await usageSnapshot() };
    },
    [],
    ["projects", "images", "events"],
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-10">
      <section className="flex flex-wrap items-end justify-between gap-6 pt-2">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-accent-text">
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" aria-hidden />
            One Story. Every Channel.
          </p>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.25] sm:text-[44px]">
            오늘 어떤 이야기를
            <br />
            만들어볼까요?
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed text-muted">사진 몇 장과 짧은 메모만 있으면 충분해요. 확인된 사실로 블로그와 SNS에 바로 올릴 글을 만듭니다.</p>
        </div>
        <Button
          variant="primary"
          size="lg"
          icon={<Sparkles className="size-4" />}
          onClick={async () => navigate(`/projects/${(await newProjectWithDefaults()).id}/setup`)}
        >
          새 콘텐츠 만들기
        </Button>
      </section>

      {data && data.projects.length > 0 && (!lastBackupAt || Date.now() - new Date(lastBackupAt).getTime() > 7 * 86_400_000) && (
        <Notice tone="warning" icon={<DatabaseBackup className="size-4" />} title={lastBackupAt ? "백업한 지 일주일이 지났어요" : "아직 백업하지 않았어요"}>
          <p>프로젝트와 사진은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우면 함께 사라지니 가끔 백업 파일을 받아 두세요.</p>
          <Button size="sm" className="mt-3" icon={<Download className="size-4" />} onClick={() => downloadFullBackup(toast)}>
            지금 백업하기
          </Button>
        </Notice>
      )}

      <QuickCreate />

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">최근 프로젝트</h2>
          <Link to="/library" className="inline-flex items-center gap-0.5 text-sm font-medium text-accent-text hover:underline">
            전체 라이브러리 <ChevronRight className="size-4" />
          </Link>
        </div>
        {!data ? (
          <Spinner className="mx-auto" />
        ) : data.projects.length === 0 ? (
          <EmptyState title="아직 만든 이야기가 없어요." body="사진 몇 장으로 첫 콘텐츠를 만들어보세요." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.projects.map((p, i) => (
              <ProjectCard key={p.id} project={p} cover={data.covers[i]} />
            ))}
          </div>
        )}
      </section>

      {data && (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <div
            className="grid size-14 place-items-center rounded-full text-sm font-bold text-accent-text"
            style={{ background: `conic-gradient(var(--color-accent) ${(data.usage.monthGenerations / data.usage.monthlyLimit) * 360}deg, var(--color-subtle) 0)` }}
            aria-hidden
          >
            <span className="grid size-11 place-items-center rounded-full bg-surface">{Math.round((data.usage.monthGenerations / data.usage.monthlyLimit) * 100)}%</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-ink">
              이번 달 스토리 생성 {data.usage.monthGenerations} / {data.usage.monthlyLimit}개
            </p>
            <p className="text-sm text-muted">매월 1일에 다시 계산됩니다. 남은 생성: {Math.max(0, data.usage.monthlyLimit - data.usage.monthGenerations)}개</p>
          </div>
          <Link to="/settings" className={cx("text-sm font-medium text-ink-2 hover:underline")}>
            사용량 설정
          </Link>
        </Card>
      )}
    </div>
  );
}

export function NewProjectRedirect() {
  const navigate = useNavigate();
  const started = useRef(false);
  if (!started.current) {
    started.current = true;
    void newProjectWithDefaults().then((p) => navigate(`/projects/${p.id}/setup`, { replace: true }));
  }
  return <Spinner className="mx-auto mt-20" />;
}
