import { z } from "zod";
import { escapeHtml } from "@postory/quality";
import type { PhotoRef } from "@postory/shared";

// 블로그 본문 블록 (LLM 출력) → 편집기 HTML

export const Block = z.object({
  kind: z.enum(["paragraph", "list", "quote", "photo"]),
  // paragraph·quote 본문. **굵게** 표기 허용
  text: z.string().nullable(),
  items: z.array(z.string()).nullable(),
  ordered: z.boolean().nullable(),
  photoNumber: z.number().int().nullable(),
});

export const Section = z.object({
  // null이면 소제목 없는 도입·마무리 문단
  heading: z.string().nullable(),
  blocks: z.array(Block),
});

export type Block = z.infer<typeof Block>;
export type Section = z.infer<typeof Section>;

// **굵게**만 허용하고 나머지는 이스케이프
export function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function photoMarker(photo: Pick<PhotoRef, "number" | "caption">): string {
  return `<div data-photo="${photo.number}" data-caption="${escapeHtml(photo.caption ?? "")}"></div>`;
}

export function sectionsToHtml(sections: Section[], photos: PhotoRef[], usedPhotos = new Set<number>()): string {
  const byNumber = new Map(photos.map((p) => [p.number, p]));
  const out: string[] = [];
  for (const section of sections) {
    if (section.heading?.trim()) out.push(`<h2>${inline(section.heading.trim())}</h2>`);
    for (const b of section.blocks) {
      if (b.kind === "photo") {
        const photo = b.photoNumber ? byNumber.get(b.photoNumber) : undefined;
        if (!photo || usedPhotos.has(photo.number)) continue;
        usedPhotos.add(photo.number);
        out.push(photoMarker(photo));
      } else if (b.kind === "list") {
        const items = (b.items ?? []).filter((i) => i.trim());
        if (!items.length) continue;
        const tag = b.ordered ? "ol" : "ul";
        out.push(`<${tag}>${items.map((i) => `<li><p>${inline(i)}</p></li>`).join("")}</${tag}>`);
      } else if (b.text?.trim()) {
        const tag = b.kind === "quote" ? "blockquote" : "p";
        out.push(b.kind === "quote" ? `<blockquote><p>${inline(b.text)}</p></blockquote>` : `<${tag}>${inline(b.text)}</${tag}>`);
      }
    }
  }
  return out.join("");
}
