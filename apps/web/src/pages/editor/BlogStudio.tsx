import type { Node as PMNode } from "@tiptap/pm/model";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, ChevronDown, Heading2, Heading3, List, ListOrdered, Quote, Redo2, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { countChars } from "@postory/quality";
import { REWRITE_MODE_LABELS, type BlogContent, type RewriteMode } from "@postory/shared";
import { cx, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { projectContext } from "../../lib/pipeline";
import { logEvent, logUsage } from "../../lib/repo";
import type { ContentRecord, ImageRecord, ProjectRecord } from "../../lib/types";
import { checkRewriteAllowed } from "../../lib/usage";
import { CoverCard } from "../../editor/CoverCard";
import { PhotoContext, PhotoMarker } from "../../editor/PhotoMarker";
import type { ChannelDraft } from "./useChannel";

// 블로그 스튜디오 (명세서 8장, 벤치마크 14·17장)

interface SectionInfo {
  from: number;
  to: number;
  heading: string | null;
  text: string;
}

function nodeToText(node: PMNode): string {
  switch (node.type.name) {
    case "heading":
      return `## ${node.textContent}`;
    case "photoMarker":
      return `[사진 ${node.attrs.number} 삽입]`;
    case "bulletList":
    case "orderedList": {
      const items: string[] = [];
      node.forEach((li) => items.push(`• ${li.textContent}`));
      return items.join("\n");
    }
    default:
      return node.textContent;
  }
}

// 커서가 있는 섹션: 직전 H2부터 다음 H2 전까지 (첫 H2 이전은 도입부)
function currentSection(doc: PMNode, index: number): SectionInfo | null {
  if (doc.childCount === 0) return null;
  const isH2 = (n: PMNode) => n.type.name === "heading" && n.attrs.level === 2;
  let start = Math.min(index, doc.childCount - 1);
  while (start > 0 && !isH2(doc.child(start))) start--;
  let end = start + 1;
  while (end < doc.childCount && !isH2(doc.child(end))) end++;
  let from = 0;
  for (let i = 0; i < start; i++) from += doc.child(i).nodeSize;
  let to = from;
  const lines: string[] = [];
  for (let i = start; i < end; i++) {
    const n = doc.child(i);
    to += n.nodeSize;
    const t = nodeToText(n);
    if (t.trim()) lines.push(t);
  }
  const first = doc.child(start);
  return { from, to, heading: isH2(first) ? first.textContent : null, text: lines.join("\n") };
}

function ToolbarButton({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cx("grid size-9 place-items-center rounded-md", active ? "bg-ink text-white" : "text-ink-2 hover:bg-subtle")}
    >
      {children}
    </button>
  );
}

const SECTION_MODES: RewriteMode[] = ["rewrite", "shorter", "natural", "informative"];

export function BlogStudio({ project, content, images, channel }: { project: ProjectRecord; content: ContentRecord; images: ImageRecord[]; channel: ChannelDraft<BlogContent> }) {
  const toast = useToast();
  const { draft, update, commit, externalRev } = channel;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const updateRef = useRef(update);
  updateRef.current = update;
  const [titlesOpen, setTitlesOpen] = useState(false);
  const [busy, setBusy] = useState<RewriteMode | null>(null);

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: false, underline: false, code: false, codeBlock: false, horizontalRule: false, strike: false }), PhotoMarker],
    content: draft?.html ?? "",
    editorProps: { attributes: { class: "editorial min-h-[50vh]", "aria-label": "블로그 본문" } },
    onUpdate: ({ editor }) => {
      const d = draftRef.current;
      if (d) updateRef.current({ ...d, html: editor.getHTML() });
    },
  });

  // 외부에서 버전이 바뀌면 편집기 내용을 맞춘다
  useEffect(() => {
    if (!editor || !draft) return;
    // 사진 마커 NodeView가 렌더 도중에 그려지지 않도록 다음 마이크로태스크로 미룬다
    const html = draft.html;
    queueMicrotask(() => {
      if (!editor.isDestroyed && editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRev, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const index = e.state.selection.$from.index(0);
      return {
        h2: e.isActive("heading", { level: 2 }),
        h3: e.isActive("heading", { level: 3 }),
        bold: e.isActive("bold"),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        quote: e.isActive("blockquote"),
        section: currentSection(e.state.doc, index),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  const counts = useMemo(() => {
    const text = editor?.getText() ?? "";
    const c = countChars(text);
    return { ...c, minutes: Math.max(1, Math.round(c.withoutSpaces / 500)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.html, editor]);

  async function rewriteSection(mode: RewriteMode) {
    const section = state?.section;
    if (!editor || !section || !draft || !project.masterStory) return;
    const limit = await checkRewriteAllowed();
    if (limit) return toast(limit, "alert");
    setBusy(mode);
    try {
      const res = await api.rewrite({ platform: "blog", mode, context: await projectContext(project), masterStory: project.masterStory, text: section.text });
      await logUsage(project.id, res.usage);
      if (!res.html) throw new Error("재작성 결과가 비어 있습니다.");
      editor.chain().focus().insertContentAt({ from: section.from, to: section.to }, res.html).run();
      await commit({ ...draft, html: editor.getHTML() }, "section_regenerated");
      await logEvent(project.id, "section_regenerate", { contentId: content.id, payload: { mode } });
      toast(`'${section.heading ?? "도입부"}' 섹션을 ${REWRITE_MODE_LABELS[mode]} 했습니다. 버전 기록에서 되돌릴 수 있어요.`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "재작성에 실패했습니다.", "alert");
    } finally {
      setBusy(null);
    }
  }

  if (!draft) return null;

  return (
    <PhotoContext.Provider value={images}>
      <div className="space-y-4">
        <CoverCard blog={draft} images={images} onChange={(cover) => update({ ...draft, cover })} />

        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-text">
              <Sparkles className="size-4" aria-hidden /> 블로그 제목
            </p>
            {draft.titleCandidates.length > 1 && (
              <button type="button" className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-[13px] text-muted hover:bg-subtle" onClick={() => setTitlesOpen((v) => !v)} aria-expanded={titlesOpen}>
                다른 제목 보기 ({draft.titleCandidates.length}) <ChevronDown className={cx("size-4 transition-transform", titlesOpen && "rotate-180")} />
              </button>
            )}
          </div>
          <input
            value={draft.title}
            onChange={(e) => update({ ...draft, title: e.target.value })}
            className="mt-2 w-full rounded-[10px] border border-line bg-canvas-alt px-3 py-3 text-lg font-bold text-ink outline-none focus:border-accent focus:bg-surface sm:text-xl"
            aria-label="블로그 제목"
          />
          {titlesOpen && (
            <ul className="mt-2 space-y-1">
              {draft.titleCandidates.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    className={cx("w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-subtle", t === draft.title && "bg-accent-tint text-accent-text")}
                    onClick={() => {
                      update({ ...draft, title: t });
                      setTitlesOpen(false);
                    }}
                  >
                    {t}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-surface">
          <div className="sticky top-14 z-10 flex flex-wrap items-center gap-1 rounded-t-[var(--radius-card)] border-b border-line bg-surface/95 px-3 py-2 backdrop-blur">
            <ToolbarButton label="소제목(H2)" active={state?.h2} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="작은 소제목(H3)" active={state?.h3} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
              <Heading3 className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="굵게" active={state?.bold} onClick={() => editor?.chain().focus().toggleBold().run()}>
              <Bold className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="글머리 목록" active={state?.bullet} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
              <List className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="번호 목록" active={state?.ordered} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
              <ListOrdered className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="인용" active={state?.quote} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
              <Quote className="size-4" />
            </ToolbarButton>
            <span className="mx-1 h-6 w-px bg-line" aria-hidden />
            <ToolbarButton label="실행 취소" onClick={() => editor?.chain().focus().undo().run()}>
              <Undo2 className={cx("size-4", !state?.canUndo && "opacity-40")} />
            </ToolbarButton>
            <ToolbarButton label="다시 실행" onClick={() => editor?.chain().focus().redo().run()}>
              <Redo2 className={cx("size-4", !state?.canRedo && "opacity-40")} />
            </ToolbarButton>
          </div>

          {state?.section && project.masterStory && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas-alt px-4 py-2.5">
              <span className="mr-1 max-w-full truncate text-[13px] text-muted">
                <Sparkles className="mr-1 inline size-3.5 text-accent" aria-hidden />
                현재 섹션: <strong className="text-ink">{state.section.heading ?? "도입부"}</strong>
              </span>
              {SECTION_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={!!busy}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => rewriteSection(mode)}
                  className="h-8 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 hover:border-accent hover:text-accent-text disabled:opacity-50"
                >
                  {busy === mode ? "작성 중…" : REWRITE_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          )}

          <div className="mx-auto max-w-[780px] px-5 py-8 sm:px-10 sm:py-10">
            <EditorContent editor={editor} />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line px-5 py-3 text-xs text-muted">
            <span>공백 포함 {counts.withSpaces.toLocaleString()}자</span>
            <span>공백 제외 {counts.withoutSpaces.toLocaleString()}자</span>
            <span>예상 읽기 {counts.minutes}분</span>
            <span>사진 {images.length}장</span>
          </div>
        </div>
      </div>
    </PhotoContext.Provider>
  );
}
