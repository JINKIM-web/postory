import { ArrowRight, ImagePlus, Lightbulb, Search, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CATEGORIES, categoryKind, GOALS, PLATFORMS, ProjectReadyInput, QUICK_TEXT_MAX, TONES, type Category, type Goal, type Platform, type Tone } from "@postory/shared";
import { PersonalizationPicker } from "../components/PersonalizationPicker";
import { PhotoUploader } from "../components/PhotoUploader";
import { StockPicker } from "../components/StockPicker";
import { Button, Card, Chip, cx, Field, Notice, PLATFORM_KO, PlatformIcon, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useDebouncedCallback, useLive } from "../lib/hooks";
import { resetPipeline } from "../lib/pipeline";
import { getProject, listImages, updateProject } from "../lib/repo";
import { withSaving } from "../lib/saveState";
import { setSettings, useSettings } from "../lib/settings";
import type { ProjectRecord } from "../lib/types";
import { checkGenerationAllowed } from "../lib/usage";

// 새 스토리 만들기 (명세서 7.1 Smart Input / Stitch postory_2)

const PLATFORM_DESC: Record<Platform, string> = {
  blog: "사진 배치 + 호흡 긴 에디토리얼 글",
  facebook: "Hook → Story → 핵심 메시지 → CTA",
  instagram: "캡션 + 해시태그 + 사진 순서 추천",
  shorts: "15~30초 장면별 스크립트",
};

export function SetupPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const { data } = useLive(async () => ({ project: await getProject(id), images: await listImages(id) }), [id], ["projects", "images"]);
  const [form, setForm] = useState<ProjectRecord | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockEnabled, setStockEnabled] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (data?.project && (!form || form.id !== data.project.id)) setForm(data.project);
  }, [data?.project, form]);

  useEffect(() => {
    api
      .health()
      .then((h) => setStockEnabled(h.stock.pixabay || h.stock.unsplash))
      .catch(() => setStockEnabled(false));
  }, []);

  const save = useDebouncedCallback((patch: Partial<ProjectRecord>) => void withSaving(() => updateProject(id, patch)), 600);
  // 입력이 바뀌면 자동 저장
  const set = (patch: Partial<ProjectRecord>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    setErrors([]);
    save(patch);
  };

  if (!data) return <Spinner className="mx-auto mt-20" />;
  if (!data.project || !form) return <Notice tone="alert">프로젝트를 찾을 수 없습니다.</Notice>;
  const images = data.images;
  const userPhotos = images.filter((i) => i.source === "user").length;
  const generated = Object.keys(data.project.stages).length > 0;

  async function start() {
    if (!form) return;
    save.flush();
    const parsed = ProjectReadyInput.safeParse({ ...form, photoCount: images.length });
    const errs = parsed.success ? [] : parsed.error.issues.map((i) => (i.path[0] === "category" ? "카테고리를 선택하세요." : i.path[0] === "goal" ? "콘텐츠 목적을 선택하세요." : i.message));
    if (form.category && categoryKind(form.category) === "experience" && userPhotos === 0) errs.push("경험형 콘텐츠는 직접 찍은 사진이 1장 이상 필요합니다. 참고 이미지는 경험 사진을 대신할 수 없어요.");
    if (errs.length) return setErrors(Array.from(new Set(errs)));
    const limit = await checkGenerationAllowed();
    if (limit) return setErrors([limit]);
    if (generated && !window.confirm("입력한 내용으로 콘텐츠를 처음부터 다시 만듭니다. 지금 결과는 버전 기록에 남습니다. 계속할까요?")) return;

    setStarting(true);
    await updateProject(form.id, {
      quickText: form.quickText,
      category: form.category,
      goal: form.goal,
      tone: form.tone,
      platforms: PLATFORMS.map((p) => p.value).filter((p) => form.platforms.includes(p)),
      hasSponsorship: form.hasSponsorship,
      useVoice: form.useVoice,
      brandId: form.brandId,
      productIds: form.productIds,
      ctaId: form.ctaId,
      title: form.titleEdited ? form.title : form.quickText.trim().split(/[.\n]/)[0]?.slice(0, 40) || "새 스토리",
    });
    await resetPipeline(form.id);
    setSettings({ lastTone: form.tone, lastPlatforms: form.platforms });
    navigate(`/projects/${form.id}/processing?phase=analyze`);
  }

  const togglePlatform = (p: Platform) => set({ platforms: form.platforms.includes(p) ? form.platforms.filter((x) => x !== p) : [...form.platforms, p] });

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            스토리 홈 › <span className="text-accent-text">정보 입력</span>
          </p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight sm:text-[30px]">새 스토리 만들기</h1>
        </div>
        <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface px-4 py-2.5 text-sm">
          <span className="size-2 rounded-full bg-confirmed" aria-hidden />
          <span className="text-muted">사실 기반 생성</span>
          <strong className="text-ink">확인된 정보만 사용</strong>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <ImagePlus className="size-5 text-accent" aria-hidden />
              <h2 className="text-xl font-semibold">사진 업로드</h2>
              <span className="text-sm text-muted">(최대 10장)</span>
              <span className="ml-auto rounded-full bg-accent-tint px-3 py-1 text-xs font-semibold text-accent-text">{images.length} / 10장</span>
            </div>
            <p className="mb-4 text-sm text-muted">사진 순서대로 이야기의 흐름이 만들어집니다.</p>
            <PhotoUploader
              projectId={id}
              images={images}
              extra={
                stockEnabled && (
                  <Button size="sm" variant="ghost" icon={<Search className="size-4" />} onClick={() => setStockOpen(true)}>
                    참고 이미지 검색 (Pixabay · Unsplash)
                  </Button>
                )
              }
            />
          </Card>
          {!settings.uploadNoticeDismissed && (
            <Notice tone="info" icon={<ShieldCheck className="size-4" />} title="올리기 전에 확인해 주세요" className="relative pr-10">
              타인의 얼굴, 차량 번호판, 주소·연락처 같은 개인정보가 보이지 않는지 확인하세요. 사진과 글은 이 브라우저에만 저장되며, 분석할 때만 저해상도 사본을 AI 서버로 보냅니다.
              <button className="absolute right-2 top-2 grid size-8 place-items-center rounded text-muted" onClick={() => setSettings({ uploadNoticeDismissed: true })} aria-label="안내 닫기">
                <X className="size-4" />
              </button>
            </Notice>
          )}
        </div>

        <Card className="space-y-7 p-5 sm:p-6">
          <Field label="어떤 기억을 콘텐츠로 만들고 싶나요?" aside={`${form.quickText.length} / ${QUICK_TEXT_MAX}자`}>
            <textarea
              value={form.quickText}
              maxLength={QUICK_TEXT_MAX}
              onChange={(e) => set({ quickText: e.target.value })}
              rows={4}
              placeholder={"지난 주말 성수동에서 들른 카페.\n커피가 좋았고 공간이 조용했다."}
              className="w-full resize-y rounded-[10px] border border-line bg-canvas-alt px-4 py-3 text-base leading-relaxed outline-none focus:border-accent focus:bg-surface focus:ring-3 focus:ring-accent/15"
            />
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              길게 쓰지 않아도 됩니다. 직접 경험한 사실과 느낌을 편하게 적어 주세요.
            </p>
          </Field>

          <Field label="카테고리" required>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip key={c.value} selected={form.category === c.value} onClick={() => set({ category: c.value as Category })}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="콘텐츠 목적" required>
            <select
              value={form.goal ?? ""}
              onChange={(e) => set({ goal: (e.target.value || null) as Goal | null })}
              className="h-12 w-full rounded-[10px] border border-line bg-surface px-3 text-[15px] outline-none focus:border-accent"
            >
              <option value="">목적을 선택하세요</option>
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="문체 톤" aside="기본값: 담백한">
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <Chip key={t.value} selected={form.tone === t.value} onClick={() => set({ tone: t.value as Tone })}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="동시 변환 채널" required aside={`${form.platforms.length}개 선택`}>
            <div className="grid gap-2 sm:grid-cols-2">
              {PLATFORMS.map((p) => {
                const on = form.platforms.includes(p.value);
                return (
                  <label key={p.value} className={cx("flex cursor-pointer gap-3 rounded-[10px] border p-3.5", on ? "border-accent bg-accent-tint/70" : "border-line hover:border-line-strong")}>
                    <input type="checkbox" checked={on} onChange={() => togglePlatform(p.value)} className="mt-1 size-4 accent-[var(--color-accent)]" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold text-ink">
                        <PlatformIcon platform={p.value} />
                        {PLATFORM_KO[p.value]}
                        {p.value === "blog" && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">메인 원문</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{PLATFORM_DESC[p.value]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Field>

          <PersonalizationPicker form={form} set={set} />

          <label className="flex cursor-pointer gap-3 rounded-[10px] border border-line bg-canvas-alt p-4">
            <input type="checkbox" checked={form.hasSponsorship} onChange={(e) => set({ hasSponsorship: e.target.checked })} className="mt-1 size-4 accent-[var(--color-accent)]" />
            <span>
              <span className="font-semibold text-ink">광고·협찬(경제적 대가)이 포함된 콘텐츠입니다</span>
              <span className="mt-0.5 block text-xs text-muted">선택하면 채널마다 제목 또는 본문 첫머리에 표기 문구를 자동으로 넣습니다 (추천·보증 심사지침).</span>
            </span>
          </label>
        </Card>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-[12px] sm:border sm:bg-surface sm:px-5">
        {errors.length > 0 && (
          <Notice tone="alert" icon={<TriangleAlert className="size-4" />} className="mb-3">
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Notice>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex flex-1 items-center gap-2 text-sm text-muted">
            <Sparkles className="size-4 shrink-0 text-accent" aria-hidden />
            AI는 사진과 사용자가 제공한 정보에서 확인 가능한 내용만 사용합니다.
          </p>
          <Button variant="primary" size="lg" className="w-full sm:w-auto" loading={starting} onClick={start} icon={<ArrowRight className="size-4" />}>
            {generated ? "다시 만들기" : "스토리 만들기"}
          </Button>
        </div>
      </div>

      <StockPicker open={stockOpen} onClose={() => setStockOpen(false)} projectId={id} category={form.category} images={images} />
    </div>
  );
}
