import { ArrowLeft, ArrowRight, Hash, Plus, Star, UserRound, X } from "lucide-react";
import { useState } from "react";
import { platformRules, REWRITE_MODE_LABELS, type FacebookContent, type InstagramContent, type Platform, type RewriteMode } from "@postory/shared";
import { PhotoThumb } from "../../components/PhotoThumb";
import { Card, cx, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { projectContext } from "../../lib/pipeline";
import { logEvent, logUsage } from "../../lib/repo";
import type { ContentRecord, ImageRecord, ProjectRecord } from "../../lib/types";
import { checkRewriteAllowed } from "../../lib/usage";
import type { ChannelDraft } from "./useChannel";

// Facebook (명세서 16장), Instagram (17장)

function useTextRewrite(project: ProjectRecord, content: ContentRecord, platform: Platform) {
  const toast = useToast();
  const [busy, setBusy] = useState<RewriteMode | null>(null);
  async function run(mode: RewriteMode, text: string, apply: (next: string) => Promise<void>) {
    if (!project.masterStory) return;
    const limit = await checkRewriteAllowed();
    if (limit) return toast(limit, "alert");
    setBusy(mode);
    try {
      const res = await api.rewrite({ platform, mode, context: await projectContext(project), masterStory: project.masterStory, text });
      await logUsage(project.id, res.usage);
      await apply(res.text);
      await logEvent(project.id, "section_regenerate", { contentId: content.id, payload: { mode, platform } });
      toast(`${REWRITE_MODE_LABELS[mode]} 완료. 버전 기록에서 되돌릴 수 있어요.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "재작성에 실패했습니다.", "alert");
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

function RewriteBar({ modes, busy, onRun }: { modes: RewriteMode[]; busy: RewriteMode | null; onRun: (m: RewriteMode) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          disabled={!!busy}
          onClick={() => onRun(m)}
          className="h-9 rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium text-ink-2 hover:border-accent hover:text-accent-text disabled:opacity-50"
        >
          {busy === m ? "작성 중…" : REWRITE_MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

function TextArea({ value, onChange, label, rows = 10, max }: { value: string; onChange: (v: string) => void; label: string; rows?: number; max?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex justify-between text-[13px] font-semibold text-ink">
        {label}
        <span className={cx("font-normal", max && value.length > max ? "text-alert" : "text-muted")}>
          {value.length.toLocaleString()}
          {max ? ` / ${max.toLocaleString()}` : ""}자
        </span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-y rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
      />
    </label>
  );
}

function ProfileRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-full bg-subtle text-muted">
        <UserRound className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{name}</p>
        <p className="text-xs text-muted">미리보기 · 실제 화면과 다를 수 있습니다</p>
      </div>
    </div>
  );
}

export function FacebookView({ project, content, images, channel }: { project: ProjectRecord; content: ContentRecord; images: ImageRecord[]; channel: ChannelDraft<FacebookContent> }) {
  const { draft, update, commit } = channel;
  const { busy, run } = useTextRewrite(project, content, "facebook");
  if (!draft) return null;
  return (
    <div className="grid gap-4 2xl:grid-cols-[1fr_380px]">
      <Card className="space-y-4 p-4 sm:p-5">
        <p className="text-xs text-muted">구조: Hook → Story → Key Message → CTA · 권장 {platformRules.facebook.body.recommendedMin}~{platformRules.facebook.body.recommendedMax}자(공백 제외)</p>
        <TextArea label="게시글" value={draft.body} onChange={(body) => update({ ...draft, body })} rows={14} />
        <RewriteBar modes={["rewrite", "shorter", "conversational"]} busy={busy} onRun={(m) => run(m, draft.body, (text) => commit({ ...draft, body: text }, "ai_rewrite"))} />
      </Card>
      <Card className="mx-auto h-fit w-full max-w-sm p-4">
        <ProfileRow name="내 페이지" />
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">{draft.body}</p>
        {images.length > 0 && (
          <div className={cx("mt-3 grid gap-1 overflow-hidden rounded-lg", images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {images.slice(0, 4).map((img) => (
              <PhotoThumb key={img.id} image={img} className="aspect-square w-full" />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function InstagramView({ project, content, images, channel }: { project: ProjectRecord; content: ContentRecord; images: ImageRecord[]; channel: ChannelDraft<InstagramContent> }) {
  const { draft, update, commit } = channel;
  const { busy, run } = useTextRewrite(project, content, "instagram");
  const [active, setActive] = useState(0);
  const [tag, setTag] = useState("");
  if (!draft) return null;

  const order = draft.photoOrder.filter((n) => n <= images.length);
  const current = images[(order[active] ?? 1) - 1];
  const move = (idx: number, dir: -1 | 1) => {
    const next = order.slice();
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    update({ ...draft, photoOrder: next });
    setActive(j);
  };
  const setFirst = (idx: number) => {
    const next = [order[idx]!, ...order.filter((_, i) => i !== idx)];
    update({ ...draft, photoOrder: next });
    setActive(0);
  };
  const addTag = () => {
    const t = `#${tag.replace(/^#+/, "").replace(/\s+/g, "")}`;
    if (t.length > 1 && !draft.hashtags.includes(t)) update({ ...draft, hashtags: [...draft.hashtags, t] });
    setTag("");
  };
  const tagLimit = platformRules.instagram.hashtags.recommendedMax;

  return (
    <div className="grid gap-4 2xl:grid-cols-[1fr_380px]">
      <Card className="space-y-5 p-4 sm:p-5">
        <TextArea label="캡션" value={draft.caption} onChange={(caption) => update({ ...draft, caption })} rows={9} max={platformRules.instagram.caption.max} />
        <RewriteBar modes={["rewrite", "shorter", "natural"]} busy={busy} onRun={(m) => run(m, draft.caption, (text) => commit({ ...draft, caption: text }, "ai_rewrite"))} />
        <div>
          <p className="mb-2 flex justify-between text-[13px] font-semibold text-ink">
            해시태그
            <span className={cx("font-normal", draft.hashtags.length > tagLimit ? "text-unknown" : "text-muted")}>
              {draft.hashtags.length}개 · {tagLimit}개 이하 권장
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {draft.hashtags.map((h) => (
              <span key={h} className="inline-flex h-9 items-center gap-1 rounded-full bg-visual-soft pl-3 pr-1 text-sm text-visual">
                {h}
                <button type="button" className="grid size-7 place-items-center rounded-full hover:bg-blue-100" onClick={() => update({ ...draft, hashtags: draft.hashtags.filter((x) => x !== h) })} aria-label={`${h} 삭제`}>
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <form
              className="inline-flex h-9 items-center rounded-full border border-line pl-3"
              onSubmit={(e) => {
                e.preventDefault();
                addTag();
              }}
            >
              <Hash className="size-3.5 text-muted" aria-hidden />
              <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="태그 추가" className="w-24 bg-transparent px-1 text-sm outline-none" aria-label="해시태그 추가" />
              <button type="submit" className="grid size-8 place-items-center text-muted" aria-label="추가">
                <Plus className="size-4" />
              </button>
            </form>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink">사진 순서 (첫 장이 대표 이미지)</p>
          <div className="flex flex-wrap gap-2">
            {order.map((n, i) => (
              <div key={n} className={cx("w-24 overflow-hidden rounded-lg border", i === active ? "border-accent" : "border-line")}>
                <button type="button" className="relative block w-full" onClick={() => setActive(i)} aria-label={`사진 ${n} 미리보기`}>
                  <PhotoThumb image={images[n - 1]} className="aspect-square w-full" />
                  <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 text-[11px] font-semibold text-white">{i + 1}</span>
                </button>
                <div className="flex justify-between bg-surface px-1 py-0.5">
                  <button type="button" className="grid size-7 place-items-center text-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="앞으로">
                    <ArrowLeft className="size-3.5" />
                  </button>
                  <button type="button" className="grid size-7 place-items-center text-muted disabled:opacity-30" disabled={i === 0} onClick={() => setFirst(i)} aria-label="첫 이미지로 설정" title="첫 이미지로 설정">
                    <Star className="size-3.5" />
                  </button>
                  <button type="button" className="grid size-7 place-items-center text-muted disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="뒤로">
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <Card className="mx-auto h-fit w-full max-w-sm overflow-hidden">
        <div className="p-3">
          <ProfileRow name="my_account" />
        </div>
        <div className="relative">
          <PhotoThumb image={current} full className="aspect-square w-full" />
          {order.length > 1 && (
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1" aria-hidden>
              {order.map((n, i) => (
                <span key={n} className={cx("size-1.5 rounded-full", i === active ? "bg-white" : "bg-white/50")} />
              ))}
            </div>
          )}
        </div>
        <div className="p-3 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap text-ink-2">{draft.caption}</p>
          <p className="mt-2 text-visual">{draft.hashtags.join(" ")}</p>
        </div>
      </Card>
    </div>
  );
}
