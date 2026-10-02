import type { BlogContent, BlogCover } from "@postory/shared";
import type { ImageRecord } from "./types";

// 블로그 상단 대표 카드 이미지 — 대표 사진 또는 Unsplash 이미지 위에 제목을 얹어 JPG로 만든다.
// 네이버 블로그에는 이미지가 클립보드로 넘어가지 않으므로 ZIP(00_대표카드.jpg)과 개별 다운로드로 제공한다.

export const COVER_SIZES: Record<BlogCover["ratio"], [number, number]> = {
  "1:1": [1080, 1080],
  "4:3": [1200, 900],
  "16:9": [1280, 720],
};

// 대표 이미지 기본값: 사용자가 직접 찍은 첫 번째 사진 (명세서 8.3 — 경험 사진 우선)
export function defaultCover(images: ImageRecord[]): BlogCover {
  const first = images.findIndex((i) => i.source === "user");
  return {
    enabled: true,
    source: "photo",
    photoNumber: first >= 0 ? first + 1 : images.length ? 1 : null,
    unsplash: null,
    headline: null,
    subline: "",
    showText: true,
    ratio: "4:3",
    theme: "dark",
  };
}

export function effectiveCover(blog: BlogContent, images: ImageRecord[]): BlogCover {
  return blog.cover ?? defaultCover(images);
}

async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("대표 이미지를 불러오지 못했습니다.");
  return res.blob();
}

const unsplashProxy = (url: string) => `/api/stock/unsplash/image?url=${encodeURIComponent(url)}`;

export async function coverSourceBlob(cover: BlogCover, images: ImageRecord[]): Promise<Blob | null> {
  if (cover.source === "unsplash") return cover.unsplash ? blobFromUrl(unsplashProxy(cover.unsplash.url)) : null;
  const img = cover.photoNumber ? images[cover.photoNumber - 1] : undefined;
  if (!img) return null;
  if (img.stored) return img.stored;
  return img.externalUrl ? blobFromUrl(unsplashProxy(img.externalUrl)) : null;
}

// 한글은 띄어쓰기 단위로 끊고, 한 단어가 너무 길면 글자 단위로 끊는다
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  const push = (l: string) => l.trim() && lines.push(l.trim());
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) push(line);
    line = "";
    for (const ch of word) {
      if (ctx.measureText(line + ch).width > maxWidth) {
        push(line);
        line = ch;
      } else line += ch;
    }
  }
  push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

export async function renderCover(cover: BlogCover, title: string, images: ImageRecord[]): Promise<Blob> {
  const [w, h] = COVER_SIZES[cover.ratio];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const dark = cover.theme === "dark";

  ctx.fillStyle = dark ? "#262626" : "#FAFAF7";
  ctx.fillRect(0, 0, w, h);

  const source = await coverSourceBlob(cover, images).catch(() => null);
  if (source) {
    const bitmap = await createImageBitmap(source);
    // 가운데를 기준으로 꽉 채우기
    const scale = Math.max(w / bitmap.width, h / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.drawImage(bitmap, (w - dw) / 2, (h - dh) / 2, dw, dh);
    bitmap.close();
  }

  const headline = (cover.headline ?? title).trim();
  if (cover.showText && headline) {
    // 글자가 잘 읽히도록 아래쪽 그라데이션
    const grad = ctx.createLinearGradient(0, h * 0.35, 0, h);
    grad.addColorStop(0, dark ? "rgba(23,23,23,0)" : "rgba(250,250,247,0)");
    grad.addColorStop(1, dark ? "rgba(23,23,23,0.82)" : "rgba(250,250,247,0.92)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    await document.fonts?.load(`700 64px ${FONT}`).catch(() => undefined);
    const pad = Math.round(w * 0.07);
    const size = Math.round(w * (cover.ratio === "16:9" ? 0.05 : 0.06));
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    const lines = wrap(ctx, headline, w - pad * 2, 3);
    const lineHeight = size * 1.3;
    const subSize = Math.round(size * 0.48);
    const subline = cover.subline.trim();
    let y = h - pad - (subline ? subSize * 1.8 : 0) - lineHeight * (lines.length - 1);

    // 포인트 막대
    ctx.fillStyle = "#F2664B";
    ctx.fillRect(pad, y - size - Math.round(size * 0.55), Math.round(size * 0.9), Math.max(4, Math.round(size * 0.1)));

    ctx.fillStyle = dark ? "#FFFFFF" : "#171717";
    for (const line of lines) {
      ctx.fillText(line, pad, y);
      y += lineHeight;
    }
    if (subline) {
      ctx.font = `500 ${subSize}px ${FONT}`;
      ctx.fillStyle = dark ? "rgba(255,255,255,0.85)" : "#525252";
      ctx.fillText(wrap(ctx, subline, w - pad * 2, 1)[0] ?? "", pad, y - lineHeight + subSize * 1.8);
    }
  }

  // Unsplash 출처 표기 (가이드라인)
  if (cover.source === "unsplash" && cover.unsplash) {
    const credit = `Photo by ${cover.unsplash.author} on Unsplash`;
    const s = Math.round(w * 0.014);
    ctx.font = `500 ${s}px ${FONT}`;
    ctx.fillStyle = dark ? "rgba(255,255,255,0.75)" : "rgba(23,23,23,0.6)";
    ctx.textAlign = "right";
    ctx.fillText(credit, w - Math.round(w * 0.025), Math.round(w * 0.03));
    ctx.textAlign = "left";
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("카드 이미지를 만들지 못했습니다."))), "image/jpeg", 0.9));
}
