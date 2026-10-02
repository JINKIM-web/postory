import { z } from "zod";
import { splitSentences } from "@postory/quality";
import { REWRITE_MODE_LABELS, type PhotoRef, type RewriteMode, type RewriteRequest, type RewriteResponse } from "@postory/shared";
import { callJson } from "../llm.js";
import { contextBlock, EVIDENCE_POLICY, storyBlock, STYLE_POLICY } from "../prompts.js";
import { Section, sectionsToHtml, type Block } from "./blocks.js";

// 섹션·문단 재작성 (명세서 8.4). 블로그는 "## 소제목", "[사진 N 삽입]", "• 항목" 표기의 섹션 텍스트를 받는다.

const MODE_GUIDE: Record<RewriteMode, string> = {
  rewrite: "같은 내용을 다른 문장 구성으로 다시 쓴다.",
  shorter: "핵심만 남겨 분량을 절반 정도로 줄인다.",
  natural: "어색하거나 AI 같은 표현을 사람이 쓴 듯 자연스럽게 다듬는다.",
  informative: "Master Story 근거 중 이 부분과 관련 있지만 빠진 사실을 보강한다. 근거에 없는 정보는 절대 추가하지 않는다.",
  conversational: "말하듯 편안한 대화체로 바꾼다.",
};

export function textToSection(text: string): Section {
  let heading: string | null = null;
  const blocks: Block[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push({ kind: "list", text: null, items: list, ordered: false, photoNumber: null });
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const photo = line.match(/^\[사진 (\d+) 삽입\]/);
    if (line.startsWith("## ") && heading === null && !blocks.length) heading = line.slice(3).trim();
    else if (photo) {
      flush();
      blocks.push({ kind: "photo", text: null, items: null, ordered: null, photoNumber: Number(photo[1]) });
    } else if (line.startsWith("• ")) list.push(line.slice(2));
    else {
      flush();
      blocks.push({ kind: "paragraph", text: line, items: null, ordered: null, photoNumber: null });
    }
  }
  flush();
  return { heading, blocks };
}

function mockText(mode: RewriteMode, text: string): string {
  if (mode !== "shorter") return text;
  const sentences = splitSentences(text);
  return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(" ");
}

export async function rewrite(req: RewriteRequest): Promise<RewriteResponse> {
  const { platform, mode, context, masterStory: story, text } = req;
  const base = `너는 사용자의 글 일부를 요청에 맞게 고치는 에디터다. 요청: ${REWRITE_MODE_LABELS[mode]} — ${MODE_GUIDE[mode]}
${EVIDENCE_POLICY}
${STYLE_POLICY}`;

  if (platform === "blog") {
    const photos: PhotoRef[] = story.availablePhotos.map((p, i) => ({ imageId: p.imageId, number: i + 1, caption: p.caption, source: p.source }));
    const { data, usage } = await callJson({
      operation: "rewrite",
      tier: "main",
      schemaName: "section_rewrite",
      schema: Section,
      system: `${base}
- 입력은 블로그의 한 섹션이다. "## "로 시작하는 줄은 소제목, "[사진 N 삽입]"은 사진 위치, "• "는 목록이다.
- 소제목은 heading에, 사진은 kind "photo"와 photoNumber로, 목록은 kind "list"로 돌려준다. 사진은 빼거나 번호를 바꾸지 않는다.
- 핵심 문장 1개 정도만 **굵게** 표시할 수 있다.`,
      user: `${contextBlock(context)}\n\n${storyBlock(story)}\n\n[고칠 섹션]\n${text}`,
      mock: () => {
        const section = textToSection(text);
        if (mode !== "shorter") return section;
        const paragraphs = section.blocks.filter((b) => b.kind === "paragraph");
        const drop = new Set(paragraphs.slice(Math.max(1, Math.ceil(paragraphs.length / 2))));
        return { ...section, blocks: section.blocks.filter((b) => !drop.has(b)) };
      },
    });
    return { html: sectionsToHtml([data], photos), text: "", usage: [usage] };
  }

  const { data, usage } = await callJson({
    operation: "rewrite",
    tier: "main",
    schemaName: "text_rewrite",
    schema: z.object({ text: z.string() }),
    system: `${base}\n- 입력과 같은 형식(줄바꿈 구조)을 유지한다.`,
    user: `${contextBlock(context)}\n\n${storyBlock(story)}\n\n[고칠 글]\n${text}`,
    mock: () => ({ text: mockText(mode, text) }),
  });
  return { html: null, text: data.text.trim(), usage: [usage] };
}
