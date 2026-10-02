import { Check, Download, FileText, Lightbulb } from "lucide-react";
import { useState } from "react";
import type { BlogContent } from "@postory/shared";
import { Button, cx, Modal, Notice } from "../../components/ui";

// 네이버 블로그용 복사 (명세서 15장, 벤치마크 18장)

export interface CopyChoice {
  format: "rich" | "plain";
  includeTitle: boolean;
  headingsAsBold: boolean;
}

export function CopyDialog({ open, onClose, content, onCopy, onZip, photoCount, zipSkipped }: { open: boolean; onClose: () => void; content: BlogContent; onCopy: (c: CopyChoice) => Promise<void>; onZip: () => Promise<void>; photoCount: number; zipSkipped: number }) {
  const [choice, setChoice] = useState<CopyChoice>({ format: "rich", includeTitle: false, headingsAsBold: true });
  const [busy, setBusy] = useState<"copy" | "zip" | null>(null);
  const markers = (content.html.match(/data-photo=/g) ?? []).length;

  const option = (format: CopyChoice["format"], title: string, desc: string, badge?: string) => (
    <label className={cx("flex cursor-pointer gap-3 rounded-[10px] border p-3.5", choice.format === format ? "border-accent bg-accent-tint/60" : "border-line")}>
      <input type="radio" name="format" className="mt-1 accent-[var(--color-accent)]" checked={choice.format === format} onChange={() => setChoice({ ...choice, format })} />
      <span>
        <span className="flex items-center gap-2 font-semibold text-ink">
          {title}
          {badge && <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] text-white">{badge}</span>}
        </span>
        <span className="mt-0.5 block text-[13px] text-muted">{desc}</span>
      </span>
    </label>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="블로그용 콘텐츠 복사"
      footer={
        <>
          <Button
            icon={<Download className="size-4" />}
            loading={busy === "zip"}
            disabled={photoCount === 0}
            onClick={async () => {
              setBusy("zip");
              await onZip().finally(() => setBusy(null));
            }}
          >
            이미지 ZIP 다운로드
          </Button>
          <Button
            variant="primary"
            icon={<FileText className="size-4" />}
            loading={busy === "copy"}
            onClick={async () => {
              setBusy("copy");
              await onCopy(choice).finally(() => setBusy(null));
            }}
          >
            {choice.format === "rich" ? "서식 포함 복사" : "텍스트만 복사"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          {option("rich", "Rich Text", "소제목·굵게·목록·줄바꿈을 유지해 스마트에디터에 붙여넣습니다.", "권장")}
          {option("plain", "Plain Text", "서식이 깨질 때 사용하세요. 순수 텍스트만 복사합니다.")}
        </div>
        <div className="rounded-[10px] bg-canvas-alt p-3.5 text-sm">
          <p className="mb-2 font-semibold text-ink">포함 항목</p>
          <ul className="grid grid-cols-2 gap-1.5 text-[13px] text-ink-2">
            {[...(content.cover?.enabled === false ? [] : ["상단 대표 카드 자리"]), "소제목", "굵게(Bold)", "목록", `사진 위치 마커 ${markers}개`].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-confirmed" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={choice.includeTitle} onChange={(e) => setChoice({ ...choice, includeTitle: e.target.checked })} />
            제목도 본문 맨 위에 넣기 (네이버 제목 칸에 따로 붙여넣는다면 끄세요)
          </label>
          {choice.format === "rich" && (
            <label className="mt-2 flex items-center gap-2 text-[13px]">
              <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={choice.headingsAsBold} onChange={(e) => setChoice({ ...choice, headingsAsBold: e.target.checked })} />
              소제목을 큰 굵은 글씨로 변환 (서식 손실 방지)
            </label>
          )}
        </div>
        <Notice tone="info" icon={<Lightbulb className="size-4" />}>
          이미지는 클립보드로 함께 복사되지 않습니다. ZIP의 파일 번호가 본문의 <strong>[사진 N 삽입]</strong> 번호와 같으니, 마커 자리에 같은 번호의 사진을 올리세요. 대표 카드는 <strong>00_대표카드.jpg</strong>입니다 — 네이버에서 대표 사진으로 지정하면 목록 썸네일로 보입니다.
          {zipSkipped > 0 && ` (Unsplash 참고 이미지 ${zipSkipped}장은 ZIP에서 제외됩니다)`}
        </Notice>
      </div>
    </Modal>
  );
}
