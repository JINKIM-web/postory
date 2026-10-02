import { COVER_MARKER, SPONSORSHIP_DISCLOSURE, SPONSORSHIP_TAG, type BlogCover, type ChannelContent } from "@postory/shared";
import { escapeHtml, htmlToText } from "./text.js";

// 채널 콘텐츠 ↔ 텍스트 유틸 (규칙 점검, 문장 교체, Plain Copy에 공통 사용)

export interface ChannelText {
  title?: string;
  // 본문 순수 텍스트 (사진 마커·해시태그 제외)
  text: string;
  hashtags?: string[];
  durationSec?: number;
}

const MARKER_LINE = /^\[사진 \d+ 삽입\].*$/gm;

export function channelText(content: ChannelContent): ChannelText {
  switch (content.platform) {
    case "blog":
      return { title: content.title, text: htmlToText(content.html).replace(MARKER_LINE, "").replace(/\n{3,}/g, "\n\n").trim() };
    case "facebook":
      return { text: content.body };
    case "instagram":
      return { text: content.caption, hashtags: content.hashtags };
    case "shorts":
      return {
        title: content.title,
        text: [content.hook, ...content.scenes.flatMap((s) => [s.overlayText, s.narration]), content.caption, content.description]
          .filter(Boolean)
          .join("\n"),
        hashtags: content.hashtags,
        durationSec: content.scenes.reduce((max, s) => Math.max(max, s.endSec), 0),
      };
  }
}

function replaceInHtml(html: string, from: string, to: string): string | null {
  const needle = escapeHtml(from);
  if (!html.includes(needle)) return null;
  // 같은 문장이 여러 곳(본문·핵심 정리)에 있으면 모두 바꾼다
  const replaced = html.split(needle).join(escapeHtml(to));
  // 문장을 지워서 빈 블록이 남으면 정리
  return replaced
    .replace(/<(strong|em)>\s*<\/\1>/g, "")
    .replace(/<(p|h2|h3)>\s*<\/\1>/g, "")
    .replace(/<li>(\s*<p>\s*<\/p>)?\s*<\/li>/g, "")
    .replace(/<(ul|ol)>\s*<\/\1>/g, "");
}

function replaceInText(text: string, from: string, to: string): string | null {
  if (!text.includes(from)) return null;
  return text.split(from).join(to).replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n");
}

// 문장 단위 교체. 원문을 찾지 못하면 null (적용 불가)
export function replaceSentence(content: ChannelContent, from: string, to: string): ChannelContent | null {
  if (!from) return null;
  switch (content.platform) {
    case "blog": {
      if (content.title.includes(from)) return { ...content, title: content.title.replace(from, to) };
      const html = replaceInHtml(content.html, from, to);
      return html === null ? null : { ...content, html };
    }
    case "facebook": {
      const body = replaceInText(content.body, from, to);
      return body === null ? null : { ...content, body };
    }
    case "instagram": {
      const caption = replaceInText(content.caption, from, to);
      return caption === null ? null : { ...content, caption };
    }
    case "shorts": {
      const fields = ["title", "hook", "caption", "description"] as const;
      for (const f of fields) {
        const v = replaceInText(content[f], from, to);
        if (v !== null) return { ...content, [f]: v };
      }
      for (let i = 0; i < content.scenes.length; i++) {
        const scene = content.scenes[i]!;
        for (const f of ["overlayText", "narration"] as const) {
          const v = replaceInText(scene[f], from, to);
          if (v !== null) {
            const scenes = content.scenes.slice();
            scenes[i] = { ...scene, [f]: v };
            return { ...content, scenes };
          }
        }
      }
      return null;
    }
  }
}

// 광고·협찬 표기 삽입 (명세서 41.2 — 제목 또는 본문 첫머리)
export function insertDisclosure(content: ChannelContent): ChannelContent {
  switch (content.platform) {
    case "blog":
      return { ...content, html: `<p><strong>${escapeHtml(SPONSORSHIP_DISCLOSURE)}</strong></p>${content.html}` };
    case "facebook":
      return { ...content, body: `${SPONSORSHIP_DISCLOSURE}\n\n${content.body}` };
    case "instagram":
      return {
        ...content,
        caption: `[광고] ${content.caption}`,
        hashtags: content.hashtags.includes(SPONSORSHIP_TAG) ? content.hashtags : [SPONSORSHIP_TAG, ...content.hashtags],
      };
    case "shorts":
      return { ...content, description: `${SPONSORSHIP_DISCLOSURE}\n${content.description}` };
  }
}

// 채널별 복사용 순수 텍스트
export function toPlainText(content: ChannelContent): string {
  switch (content.platform) {
    case "blog": {
      // 대표 카드는 기본으로 켜져 있다 (cover가 없으면 대표 사진 카드)
      const credit = coverCredit(content.cover);
      const cover = content.cover?.enabled === false ? "" : `${COVER_MARKER}${credit ? ` ${credit}` : ""}\n\n`;
      return `${content.title}\n\n${cover}${htmlToText(content.html)}`;
    }
    case "facebook":
      return content.body;
    case "instagram":
      return [content.caption, content.hashtags.join(" ")].filter(Boolean).join("\n\n");
    case "shorts": {
      const scenes = content.scenes
        .map((s) => {
          const photo = s.photoNumber ? ` · 사진 ${s.photoNumber}` : "";
          return `${s.startSec}~${s.endSec}초${photo}\n  화면 자막: ${s.overlayText}\n  내레이션: ${s.narration}`;
        })
        .join("\n");
      return [
        `제목: ${content.title}`,
        `Hook: ${content.hook}`,
        `[장면 구성]\n${scenes}`,
        `캡션: ${content.caption}`,
        `설명:\n${content.description}`,
        content.hashtags.join(" "),
      ].join("\n\n");
    }
  }
}

// Unsplash 이미지 출처 표기 (명세서 8.3, Unsplash 가이드라인)
export function coverCredit(cover: BlogCover | undefined): string {
  if (!cover?.enabled || cover.source !== "unsplash" || !cover.unsplash) return "";
  return `Photo by ${cover.unsplash.author} on Unsplash`;
}
