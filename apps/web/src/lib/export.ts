import { strToU8, zipSync } from "fflate";
import { channelText, escapeHtml, toPlainText } from "@postory/quality";
import { COVER_MARKER, type BlogContent, type ChannelContent } from "@postory/shared";
import type { ImageRecord } from "./types";

// 출력 (명세서 15장): Rich/Plain Copy, 사진 번호를 맞춘 ZIP, 텍스트 다운로드

export interface RichCopyOptions {
  includeTitle: boolean;
  // 네이버 PoC 결과 전까지 소제목을 굵은 문단으로 바꿔 서식 손실을 줄인다 (미결 #6)
  headingsAsBold: boolean;
}

export function blogRichHtml(content: BlogContent, opts: RichCopyOptions): string {
  let html = content.html.replace(
    /<div[^>]*data-photo="(\d+)"[^>]*?(?:data-caption="([^"]*)")?[^>]*>\s*<\/div>/g,
    (_m, n: string, caption?: string) => `<p>[사진 ${n} 삽입]${caption ? ` ${caption}` : ""}</p>`,
  );
  if (opts.headingsAsBold) {
    html = html.replace(/<h2[^>]*>(.*?)<\/h2>/g, '<p><br></p><p><strong><span style="font-size:19px">$1</span></strong></p>').replace(/<h3[^>]*>(.*?)<\/h3>/g, "<p><strong>$1</strong></p>");
  }
  // 상단 대표 카드 자리 + Unsplash 출처 (링크 포함)
  const c = content.cover;
  const cover =
    c?.enabled === false
      ? ""
      : `<p>${COVER_MARKER}</p>${
          c?.source === "unsplash" && c.unsplash
            ? `<p><span style="font-size:13px">Photo by <a href="${escapeHtml(c.unsplash.authorUrl)}">${escapeHtml(c.unsplash.author)}</a> on <a href="${escapeHtml(c.unsplash.pageUrl)}">Unsplash</a></span></p>`
            : ""
        }<p><br></p>`;
  const title = opts.includeTitle ? `<p><strong><span style="font-size:24px">${escapeHtml(content.title)}</span></strong></p><p><br></p>` : "";
  return `<div>${title}${cover}${html}</div>`;
}

export async function copyRich(html: string, plain: string): Promise<void> {
  // HTTPS(또는 localhost)에서만 동작 (명세서 15.2)
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) }),
    ]);
    return;
  }
  // 대체 경로: 선택 영역 복사
  const el = document.createElement("div");
  el.contentEditable = "true";
  el.innerHTML = html;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  const ok = document.execCommand("copy");
  sel.removeAllRanges();
  el.remove();
  if (!ok) throw new Error("클립보드에 복사하지 못했습니다.");
}

export async function copyPlain(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function plainFor(content: ChannelContent, includeTitle = true): string {
  if (content.platform === "blog" && !includeTitle) return toPlainText(content).split("\n").slice(2).join("\n");
  return toPlainText(content);
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 30) || "사진";
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 본문의 [사진 N 삽입] 번호와 파일 번호를 맞춘 ZIP. EXIF가 제거된 저장본만 담는다.
// Unsplash 이미지는 내려받기 저장 대상이 아니므로 제외한다 (명세서 27.3).
export async function buildImageZip(
  images: ImageRecord[],
  cover?: { blob: Blob; credit: string | null },
): Promise<{ blob: Blob; count: number; skipped: number[] }> {
  const files: Record<string, Uint8Array> = {};
  const credits: string[] = [];
  // 00: 상단 대표 카드
  if (cover) {
    files["00_대표카드.jpg"] = new Uint8Array(await cover.blob.arrayBuffer());
    if (cover.credit) credits.push(`대표 카드: ${cover.credit}`);
  }
  const skipped: number[] = [];
  for (const [i, img] of images.entries()) {
    const n = i + 1;
    if (!img.stored) {
      skipped.push(n);
      continue;
    }
    const caption = img.source === "user" ? (img.caption ?? "사진") : "참고이미지";
    files[`${String(n).padStart(2, "0")}_${safeName(caption)}.jpg`] = new Uint8Array(await img.stored.arrayBuffer());
    if (img.attribution) credits.push(`사진 ${n}: ${img.attribution.author} (${img.attribution.provider}) ${img.attribution.pageUrl}`);
  }
  if (credits.length) files["출처.txt"] = strToU8(credits.join("\n"));
  const zipped = zipSync(files, { level: 0 });
  return { blob: new Blob([zipped as BlobPart], { type: "application/zip" }), count: Object.keys(files).filter((f) => f.endsWith(".jpg")).length, skipped };
}

// ---------- Copy-ready Rate (명세서 39.3) ----------

function tokens(content: ChannelContent): string[] {
  const t = channelText(content);
  return `${t.title ?? ""} ${t.text} ${(t.hashtags ?? []).join(" ")}`.split(/\s+/).filter(Boolean);
}

// 단어 단위 편집 거리 비율 (0 = 그대로, 1 = 전부 바뀜)
export function editRatio(before: ChannelContent, after: ChannelContent): number {
  const a = tokens(before);
  const b = tokens(after);
  if (!a.length && !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]! / Math.max(a.length, b.length);
}
