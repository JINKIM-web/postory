// HTML ↔ 텍스트 유틸. 브라우저와 Node 양쪽에서 쓰므로 DOM에 의존하지 않는다.

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 블로그 HTML → 순수 텍스트 (Plain Copy, 규칙 점검용)
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<div[^>]*data-photo="(\d+)"[^>]*data-caption="([^"]*)"[^>]*>\s*<\/div>/g, "\n\n[사진 $1 삽입] $2\n\n")
      .replace(/<div[^>]*data-photo="(\d+)"[^>]*>\s*<\/div>/g, "\n\n[사진 $1 삽입]\n\n")
      .replace(/<li[^>]*>(\s*<p[^>]*>)?/g, "\n• ")
      .replace(/(<\/p>\s*)?<\/li>/g, "")
      .replace(/<\/(p|h1|h2|h3|blockquote|ul|ol|div)>/g, "\n\n")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。])\s+|\n+/)
    // 목록 글머리(• - ·)는 본문에 없는 문자이므로 떼어 낸다 (문장 교체가 실패하지 않도록)
    .map((s) => s.trim().replace(/^[•·-]\s*/, ""))
    .filter((s) => s.length > 0);
}

// 공백 포함 / 제외 글자 수
export function countChars(text: string): { withSpaces: number; withoutSpaces: number } {
  return { withSpaces: text.length, withoutSpaces: text.replace(/\s/g, "").length };
}
