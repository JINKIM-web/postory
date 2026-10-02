import { mergeAttributes, Node, type Editor } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ArrowDown, ArrowUp, ImageOff, Trash2 } from "lucide-react";
import { createContext, useContext } from "react";
import { useObjectUrl } from "../lib/hooks";
import type { ImageRecord } from "../lib/types";

// 본문 사진 위치 마커 블록 (계획서 4.2 ImageMarkerBlock) — HTML: <div data-photo="N" data-caption="..."></div>

export const PhotoContext = createContext<ImageRecord[]>([]);

function moveNode(editor: Editor, pos: number, direction: -1 | 1) {
  editor
    .chain()
    .command(({ tr, state }) => {
      const node = state.doc.nodeAt(pos);
      if (!node) return false;
      const index = state.doc.resolve(pos).index(0);
      const sibling = state.doc.maybeChild(index + direction);
      if (!sibling) return false;
      tr.delete(pos, pos + node.nodeSize);
      tr.insert(direction === -1 ? pos - sibling.nodeSize : pos + sibling.nodeSize, node);
      return true;
    })
    .run();
}

function MarkerView({ node, editor, getPos, deleteNode, selected }: ReactNodeViewProps) {
  const images = useContext(PhotoContext);
  const number = Number(node.attrs.number);
  const image = images[number - 1];
  const thumb = useObjectUrl(image?.thumb);
  const src = thumb ?? image?.externalThumbUrl ?? null;
  const caption = (image?.source === "user" ? image.caption : null) ?? node.attrs.caption ?? "";
  const pos = () => getPos() ?? 0;

  return (
    <NodeViewWrapper
      className={`my-5 flex items-center gap-4 rounded-[var(--radius-marker)] border border-dashed bg-canvas-alt p-3 ${selected ? "border-accent" : "border-line-strong"}`}
      data-drag-handle
      contentEditable={false}
    >
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md bg-subtle sm:size-20">
        {src ? <img src={src} alt={caption || `사진 ${number}`} className="size-full object-cover" /> : <ImageOff className="size-5 text-muted" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-visual">
          [사진 {String(number).padStart(2, "0")}] {caption}
        </p>
        <p className="mt-0.5 text-xs text-muted">{image ? "사진 삽입 위치 · ZIP 파일 번호와 같습니다" : "연결된 사진이 없습니다"}</p>
      </div>
      {editor.isEditable && (
        <div className="flex shrink-0 gap-1">
          <button type="button" className="grid size-9 place-items-center rounded-md text-muted hover:bg-subtle" onClick={() => moveNode(editor, pos(), -1)} aria-label="위로 이동">
            <ArrowUp className="size-4" />
          </button>
          <button type="button" className="grid size-9 place-items-center rounded-md text-muted hover:bg-subtle" onClick={() => moveNode(editor, pos(), 1)} aria-label="아래로 이동">
            <ArrowDown className="size-4" />
          </button>
          <button type="button" className="grid size-9 place-items-center rounded-md text-muted hover:bg-alert-soft hover:text-alert" onClick={deleteNode} aria-label="사진 마커 삭제">
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const PhotoMarker = Node.create({
  name: "photoMarker",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      number: { default: 1, parseHTML: (el) => Number(el.getAttribute("data-photo")), renderHTML: (a) => ({ "data-photo": a.number }) },
      caption: { default: "", parseHTML: (el) => el.getAttribute("data-caption") ?? "", renderHTML: (a) => ({ "data-caption": a.caption }) },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-photo]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MarkerView);
  },
});
