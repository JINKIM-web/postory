import { ArrowLeft, ArrowRight, ImagePlus, ShieldCheck, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { MAX_PHOTOS } from "@postory/shared";
import { formatTakenDate, processUpload, UploadError } from "../lib/images";
import { deleteImage, putImage, reorderImages, updateImage } from "../lib/repo";
import type { ImageRecord } from "../lib/types";
import { PhotoThumb } from "./PhotoThumb";
import { cx, Notice, useToast } from "./ui";

// 사진 업로드·순서 변경·캡션 (명세서 7.1, 32.2 / 벤치마크 10장)

export async function addFiles(projectId: string, files: File[], existingCount: number): Promise<{ added: number; errors: string[] }> {
  const errors: string[] = [];
  const room = MAX_PHOTOS - existingCount;
  if (files.length > room) errors.push(`사진은 최대 ${MAX_PHOTOS}장입니다. ${files.length - Math.max(0, room)}장은 추가하지 않았습니다.`);
  let added = 0;
  for (const file of files.slice(0, Math.max(0, room))) {
    try {
      await putImage(await processUpload(file, projectId, existingCount + added));
      added++;
    } catch (err) {
      errors.push(err instanceof UploadError ? err.message : `${file.name}: 처리하지 못했습니다.`);
    }
  }
  return { added, errors };
}

export function PhotoUploader({ projectId, images, extra }: { projectId: string; images: ImageRecord[]; extra?: React.ReactNode }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  async function handle(files: File[]) {
    if (!files.length) return;
    setBusy(files.length);
    const { errors } = await addFiles(projectId, files, images.length);
    setBusy(0);
    for (const e of errors) toast(e, "alert");
  }

  function move(idx: number, dir: -1 | 1) {
    const ids = images.map((i) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j]!, ids[idx]!];
    void reorderImages(projectId, ids);
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = images.map((i) => i.id).filter((x) => x !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    void reorderImages(projectId, ids);
    setDragId(null);
  }

  const dates = Array.from(new Set(images.filter((i) => i.takenAt).map((i) => formatTakenDate(i.takenAt!))));
  const full = images.length >= MAX_PHOTOS;

  return (
    <div className="space-y-4">
      <div
        className={cx("grid grid-cols-2 gap-3 sm:grid-cols-3", dragOver && "rounded-[12px] ring-2 ring-accent ring-offset-4 ring-offset-surface")}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragOver(false);
          void handle(Array.from(e.dataTransfer.files));
        }}
      >
        {images.map((img, idx) => (
          <figure
            key={img.id}
            draggable
            onDragStart={() => setDragId(img.id)}
            onDragOver={(e) => dragId && e.preventDefault()}
            onDrop={(e) => {
              if (dragId) {
                e.preventDefault();
                e.stopPropagation();
                dropOn(img.id);
              }
            }}
            className={cx("overflow-hidden rounded-[10px] border bg-surface", dragId === img.id ? "border-accent opacity-60" : "border-line")}
          >
            <div className="relative">
              <PhotoThumb image={img} className="aspect-[4/3] w-full" />
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/85 px-2 py-0.5 text-xs font-semibold text-white">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                {String(idx + 1).padStart(2, "0")}
              </span>
              {img.source !== "user" && <span className="absolute bottom-2 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-ink">참고 이미지</span>}
              <button
                type="button"
                className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-white/90 text-ink hover:bg-white"
                onClick={() => deleteImage(projectId, img.id)}
                aria-label={`사진 ${idx + 1} 삭제`}
              >
                <X className="size-4" />
              </button>
            </div>
            <figcaption className="space-y-1 p-2">
              {img.source === "user" ? (
                <input
                  defaultValue={img.caption ?? ""}
                  key={img.caption ?? ""}
                  onBlur={(e) => {
                    const caption = e.target.value.trim() || null;
                    if (caption !== img.caption) void updateImage(img.id, { caption, captionEdited: !!caption });
                  }}
                  placeholder="사진 설명 (선택)"
                  className="w-full rounded-md px-1.5 py-1 text-[13px] text-ink outline-none placeholder:text-muted focus:bg-subtle"
                  aria-label={`사진 ${idx + 1} 설명`}
                />
              ) : (
                <p className="truncate px-1.5 text-[11px] text-muted">
                  {img.attribution?.author} · {img.attribution?.provider === "unsplash" ? "Unsplash" : "Pixabay"}
                </p>
              )}
              <div className="flex justify-between">
                <button type="button" className="grid size-8 place-items-center rounded text-muted disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="앞으로 이동">
                  <ArrowLeft className="size-4" />
                </button>
                <button type="button" className="grid size-8 place-items-center rounded text-muted disabled:opacity-30" disabled={idx === images.length - 1} onClick={() => move(idx, 1)} aria-label="뒤로 이동">
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line-strong bg-canvas-alt text-sm text-ink-2 hover:border-accent hover:text-accent-text sm:aspect-auto sm:min-h-[180px]"
          >
            {busy ? <Upload className="size-6 animate-pulse text-accent" aria-hidden /> : <ImagePlus className="size-6 text-accent" aria-hidden />}
            <span className="font-medium">{busy ? `${busy}장 처리 중…` : "+ 사진 추가하기"}</span>
            <span className="text-xs text-muted">JPG, PNG, WEBP, HEIC · 드래그해서 놓아도 됩니다</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          void handle(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {images.length > 1 && <p className="text-xs text-muted">사진을 끌어서 놓거나 화살표로 순서를 바꿀 수 있어요. 이 순서가 본문의 사진 번호가 됩니다.</p>}
      {extra}
      {dates.length > 0 && (
        <Notice tone="visual" icon={<ShieldCheck className="size-4" />} title={`촬영일시 감지 · ${dates.join(", ")}`}>
          촬영일은 확인 질문에서 맞다고 답한 경우에만 본문에 씁니다. 사진의 GPS 위치 정보는 저장하지 않고 제거했습니다.
        </Notice>
      )}
    </div>
  );
}
