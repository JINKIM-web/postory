import { Download, ImageIcon, LoaderCircle, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { BlogContent, BlogCover, StockImage } from "@postory/shared";
import { PhotoThumb } from "../components/PhotoThumb";
import { Button, Chip, cx, Notice, useToast } from "../components/ui";
import { api } from "../lib/api";
import { effectiveCover, renderCover } from "../lib/cover";
import { downloadBlob } from "../lib/export";
import { useDebouncedCallback } from "../lib/hooks";
import type { ImageRecord } from "../lib/types";

// 블로그 상단 대표 카드 — 대표 사진 또는 Unsplash 이미지 + 제목

export function CoverCard({ blog, images, onChange, onDownloaded }: { blog: BlogContent; images: ImageRecord[]; onChange: (cover: BlogCover) => void; onDownloaded?: () => void }) {
  const toast = useToast();
  const cover = effectiveCover(blog, images);
  const [preview, setPreview] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [unsplashReady, setUnsplashReady] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockImage[] | null>(null);
  const [searching, setSearching] = useState(false);
  const set = (patch: Partial<BlogCover>) => onChange({ ...cover, ...patch });

  useEffect(() => {
    api
      .health()
      .then((h) => setUnsplashReady(h.stock.unsplash))
      .catch(() => setUnsplashReady(false));
  }, []);

  // 설정이 바뀌면 미리보기를 다시 그린다
  const render = useDebouncedCallback((c: BlogCover, title: string) => {
    if (!c.enabled) return setPreview(null);
    setRendering(true);
    renderCover(c, title, images)
      .then((blob) => setPreview((old) => (old && URL.revokeObjectURL(old), URL.createObjectURL(blob))))
      .catch(() => setPreview(null))
      .finally(() => setRendering(false));
  }, 300);
  const key = JSON.stringify(cover) + blog.title + images.map((i) => i.id).join();
  useEffect(() => render(cover, blog.title), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults((await api.stockSearch(query.trim(), "unsplash")).images);
    } catch (err) {
      toast(err instanceof Error ? err.message : "검색에 실패했습니다.", "alert");
    } finally {
      setSearching(false);
    }
  }

  async function pickUnsplash(img: StockImage) {
    set({ source: "unsplash", unsplash: { id: img.id, url: img.url, thumbUrl: img.thumbUrl, author: img.author, authorUrl: img.authorUrl, pageUrl: img.pageUrl } });
    // 사용자가 사진을 고르면 다운로드 추적 엔드포인트를 호출해야 한다 (Unsplash API 가이드라인)
    if (img.downloadLocation) await api.trackUnsplash(img.downloadLocation).catch(() => undefined);
  }

  async function download() {
    try {
      const blob = await renderCover(cover, blog.title, images);
      downloadBlob(blob, "00_대표카드.jpg");
      onDownloaded?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "카드 이미지를 만들지 못했습니다.", "alert");
    }
  }

  const photoChoices = images.map((img, i) => ({ img, n: i + 1 })).filter(({ img }) => img.stored || img.externalUrl);

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-text">
          <ImageIcon className="size-4" aria-hidden /> 상단 대표 카드 이미지
        </p>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={cover.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          블로그 맨 위에 넣기
        </label>
      </div>

      {cover.enabled && (
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="relative overflow-hidden rounded-[10px] bg-subtle" style={{ aspectRatio: cover.ratio.replace(":", " / ") }}>
              {preview ? <img src={preview} alt="대표 카드 미리보기" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-sm text-muted">이미지를 고르세요</div>}
              {rendering && <LoaderCircle className="absolute right-3 top-3 size-5 animate-spin text-white drop-shadow" aria-label="그리는 중" />}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" icon={<Download className="size-4" />} onClick={download}>
                카드 이미지 다운로드
              </Button>
              <span className="text-xs text-muted">이미지 ZIP에도 00번으로 들어갑니다</span>
            </div>
          </div>

          <div className="space-y-4">
            <div role="radiogroup" aria-label="이미지 출처" className="flex gap-1 rounded-[10px] bg-subtle p-1">
              {(
                [
                  ["photo", "대표 사진"],
                  ["unsplash", "Unsplash"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={cover.source === v}
                  onClick={() => set({ source: v })}
                  className={cx("h-9 flex-1 rounded-lg text-[13px] font-medium", cover.source === v ? "bg-surface text-ink shadow-sm" : "text-muted")}
                >
                  {label}
                </button>
              ))}
            </div>

            {cover.source === "photo" ? (
              photoChoices.length ? (
                <div className="flex flex-wrap gap-2">
                  {photoChoices.map(({ img, n }) => (
                    <button
                      key={img.id}
                      onClick={() => set({ photoNumber: n })}
                      className={cx("relative overflow-hidden rounded-lg border-2", cover.photoNumber === n ? "border-accent" : "border-transparent")}
                      aria-label={`사진 ${n}을 대표 이미지로`}
                      aria-pressed={cover.photoNumber === n}
                    >
                      <PhotoThumb image={img} className="size-16" />
                      <span className="absolute left-1 top-1 rounded bg-ink/80 px-1 text-[10px] font-semibold text-white">{n}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">사진이 없습니다. Unsplash에서 고르세요.</p>
              )
            ) : unsplashReady === false ? (
              <Notice tone="warning">
                Unsplash 키가 없습니다. <code className="font-mono text-xs">apps/api/.env.local</code>의 <code className="font-mono text-xs">UNSPLASH_ACCESS_KEY</code>를 채우고 API 서버를 다시 시작하세요.
              </Notice>
            ) : (
              <div className="space-y-3">
                <form onSubmit={search} className="flex gap-2">
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예: cafe latte, seoul street" className="h-10 min-w-0 flex-1 rounded-[10px] border border-line px-3 text-sm outline-none focus:border-accent" aria-label="Unsplash 검색어" />
                  <Button type="submit" size="sm" loading={searching} icon={<Search className="size-4" />}>
                    검색
                  </Button>
                </form>
                {results && !results.length && <p className="text-sm text-muted">결과가 없습니다. 영어 검색어가 더 잘 맞습니다.</p>}
                {results && results.length > 0 && (
                  <ul className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto">
                    {results.map((img) => (
                      <li key={img.id}>
                        <button
                          onClick={() => pickUnsplash(img)}
                          className={cx("block w-full overflow-hidden rounded-lg border-2", cover.unsplash?.id === img.id ? "border-accent" : "border-transparent")}
                          aria-label={`${img.author}의 사진 선택`}
                        >
                          <img src={img.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {cover.unsplash && (
                  <p className="text-xs text-muted">
                    Photo by{" "}
                    <a href={cover.unsplash.authorUrl} target="_blank" rel="noreferrer" className="underline">
                      {cover.unsplash.author}
                    </a>{" "}
                    on{" "}
                    <a href={cover.unsplash.pageUrl} target="_blank" rel="noreferrer" className="underline">
                      Unsplash
                    </a>{" "}
                    · 참고 이미지이므로 실제 방문·사용 사진처럼 소개하지 마세요.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[13px] text-ink-2">
                <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={cover.showText} onChange={(e) => set({ showText: e.target.checked })} />
                카드에 글자 넣기
              </label>
              {cover.showText && (
                <>
                  <input
                    value={cover.headline ?? ""}
                    onChange={(e) => set({ headline: e.target.value || null })}
                    placeholder={`제목 그대로: ${blog.title}`}
                    className="h-10 w-full rounded-[10px] border border-line px-3 text-sm outline-none focus:border-accent"
                    aria-label="카드 제목"
                  />
                  <input value={cover.subline} onChange={(e) => set({ subline: e.target.value })} placeholder="보조 문구 (선택) 예: 성수동 · 2026.10" className="h-10 w-full rounded-[10px] border border-line px-3 text-sm outline-none focus:border-accent" aria-label="보조 문구" />
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {(["4:3", "1:1", "16:9"] as const).map((r) => (
                <Chip key={r} selected={cover.ratio === r} onClick={() => set({ ratio: r })} className="min-h-9 px-3 text-[13px]">
                  {r}
                </Chip>
              ))}
              <span className="mx-1 w-px bg-line" aria-hidden />
              {(
                [
                  ["dark", "어두운 글자 배경"],
                  ["light", "밝은 글자 배경"],
                ] as const
              ).map(([t, label]) => (
                <Chip key={t} selected={cover.theme === t} onClick={() => set({ theme: t })} className="min-h-9 px-3 text-[13px]">
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
