import { Clapperboard, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { platformRules, type ShortsContent, type ShortsScene } from "@postory/shared";
import { PhotoThumb } from "../../components/PhotoThumb";
import { Button, Card, cx } from "../../components/ui";
import type { ImageRecord } from "../../lib/types";
import type { ChannelDraft } from "./useChannel";

// YouTube Shorts (명세서 18장) — MVP는 스토리보드와 스크립트

const ROLE_LABEL: Record<ShortsScene["role"], string> = { hook: "Hook", photo: "사진", key_point: "핵심 포인트", cta: "CTA" };

const input = "w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent";

function retime(scenes: ShortsScene[]): ShortsScene[] {
  let t = 0;
  return scenes.map((s) => {
    const len = Math.max(1, s.endSec - s.startSec);
    const next = { ...s, startSec: t, endSec: t + len };
    t += len;
    return next;
  });
}

export function ShortsView({ images, channel }: { images: ImageRecord[]; channel: ChannelDraft<ShortsContent> }) {
  const { draft, update } = channel;
  const [active, setActive] = useState(0);
  if (!draft) return null;
  const scene = draft.scenes[active] ?? draft.scenes[0];
  const total = draft.scenes.at(-1)?.endSec ?? 0;
  const rules = platformRules.shorts;

  const setScene = (i: number, patch: Partial<ShortsScene>) => {
    const scenes = draft.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s));
    update({ ...draft, scenes: retime(scenes) });
  };

  return (
    <div className="grid gap-4 2xl:grid-cols-[260px_1fr]">
      <div className="space-y-3">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[18px] bg-ink">
          {scene?.photoNumber ? <PhotoThumb image={images[scene.photoNumber - 1]} full className="absolute inset-0 size-full" /> : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
          {scene && (
            <p className="absolute inset-x-4 top-1/3 text-center text-lg font-bold leading-snug text-white [text-shadow:0_2px_8px_rgba(0,0,0,.5)]">{scene.overlayText}</p>
          )}
          <p className="absolute inset-x-4 bottom-4 text-sm text-white/90">{scene?.narration}</p>
          <span className="absolute right-3 top-3 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
            {scene?.startSec}~{scene?.endSec}초
          </span>
        </div>
        <p className={cx("text-center text-xs", total > rules.durationSec.max ? "text-alert" : "text-muted")}>
          총 {total}초 · 권장 {rules.durationSec.min}~{rules.durationSec.max}초
        </p>
        <Button className="w-full" disabled icon={<Clapperboard className="size-4" />} title="Phase 2에서 제공됩니다">
          영상 만들기 (Soon)
        </Button>
      </div>

      <div className="space-y-4">
        <Card className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <label className="sm:col-span-2">
            <span className="mb-1 flex justify-between text-[13px] font-semibold text-ink">
              제목 <span className="font-normal text-muted">{draft.title.length} / {rules.title.max}</span>
            </span>
            <input className={input} value={draft.title} maxLength={rules.title.max} onChange={(e) => update({ ...draft, title: e.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-[13px] font-semibold text-ink">Hook</span>
            <input className={input} value={draft.hook} onChange={(e) => update({ ...draft, hook: e.target.value })} />
          </label>
        </Card>

        <ol className="space-y-2">
          {draft.scenes.map((s, i) => (
            <li key={i}>
              <Card className={cx("p-3 sm:p-4", i === active && "border-accent")}>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setActive(i)} className="shrink-0" aria-label={`장면 ${i + 1} 미리보기`}>
                    <PhotoThumb image={s.photoNumber ? images[s.photoNumber - 1] : undefined} className="h-20 w-14 rounded-md" />
                  </button>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-ink px-2 py-0.5 font-mono text-white">
                        {s.startSec}~{s.endSec}s
                      </span>
                      <span className="font-semibold text-ink">{ROLE_LABEL[s.role]}</span>
                      <label className="ml-auto flex items-center gap-1 text-muted">
                        길이
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={s.endSec - s.startSec}
                          onChange={(e) => setScene(i, { endSec: s.startSec + Math.max(1, Number(e.target.value) || 1) })}
                          className="w-14 rounded-md border border-line px-2 py-1 text-ink"
                          aria-label="장면 길이(초)"
                        />
                        초
                      </label>
                      <select
                        value={s.photoNumber ?? ""}
                        onChange={(e) => setScene(i, { photoNumber: e.target.value ? Number(e.target.value) : null })}
                        className="rounded-md border border-line px-2 py-1 text-ink"
                        aria-label="장면 사진"
                      >
                        <option value="">사진 없음</option>
                        {images.map((_, n) => (
                          <option key={n} value={n + 1}>
                            사진 {n + 1}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="grid size-8 place-items-center rounded-md text-muted hover:bg-alert-soft hover:text-alert"
                        onClick={() => {
                          update({ ...draft, scenes: retime(draft.scenes.filter((_, j) => j !== i)) });
                          setActive(0);
                        }}
                        aria-label="장면 삭제"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <input className={input} value={s.overlayText} onChange={(e) => setScene(i, { overlayText: e.target.value })} aria-label="화면 자막" placeholder="화면 자막" />
                    <textarea className={cx(input, "resize-y")} rows={2} value={s.narration} onChange={(e) => setScene(i, { narration: e.target.value })} aria-label="내레이션" placeholder="내레이션" />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
        <Button
          size="sm"
          icon={<Plus className="size-4" />}
          onClick={() => update({ ...draft, scenes: retime([...draft.scenes, { startSec: total, endSec: total + 3, role: "key_point", photoNumber: null, overlayText: "", narration: "" }]) })}
        >
          장면 추가
        </Button>

        <Card className="grid gap-3 p-4 sm:p-5">
          <label>
            <span className="mb-1 block text-[13px] font-semibold text-ink">캡션</span>
            <input className={input} value={draft.caption} onChange={(e) => update({ ...draft, caption: e.target.value })} />
          </label>
          <label>
            <span className="mb-1 block text-[13px] font-semibold text-ink">설명</span>
            <textarea className={cx(input, "resize-y")} rows={4} value={draft.description} onChange={(e) => update({ ...draft, description: e.target.value })} />
          </label>
          <label>
            <span className="mb-1 block text-[13px] font-semibold text-ink">해시태그 (공백으로 구분)</span>
            <input
              key={draft.hashtags.join(" ")}
              className={input}
              defaultValue={draft.hashtags.join(" ")}
              onBlur={(e) => update({ ...draft, hashtags: e.target.value.split(/\s+/).filter(Boolean).map((t) => `#${t.replace(/^#+/, "")}`) })}
            />
          </label>
        </Card>
      </div>
    </div>
  );
}
