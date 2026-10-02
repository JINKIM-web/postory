import { Search } from "lucide-react";
import { useState } from "react";
import { categoryKind, MAX_PHOTOS, type Category, type StockImage } from "@postory/shared";
import { api } from "../lib/api";
import { now, uid } from "../lib/db";
import { processRemoteBlob } from "../lib/images";
import { putImage, reorderImages } from "../lib/repo";
import type { ImageRecord } from "../lib/types";
import { Button, Modal, Notice, Spinner, useToast } from "./ui";

// 스톡 이미지 (Phase 1C, 명세서 8.3)
// 경험형 Category: 커버 용도 1장만, 맨 앞에 둔다. 경험 사진을 대신할 수 없다.
// 정보형 Category: 본문 보조 이미지로 사용 가능.

export function StockPicker({ open, onClose, projectId, category, images }: { open: boolean; onClose: () => void; projectId: string; category: Category | null; images: ImageRecord[] }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StockImage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const experience = !category || categoryKind(category) === "experience";
  const stockCount = images.filter((i) => i.source !== "user").length;
  const blocked = experience ? stockCount >= 1 : images.length >= MAX_PHOTOS;

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      setResults((await api.stockSearch(q.trim())).images);
    } catch (err) {
      toast(err instanceof Error ? err.message : "검색에 실패했습니다.", "alert");
    } finally {
      setLoading(false);
    }
  }

  async function pick(img: StockImage) {
    setAdding(img.id);
    try {
      const base: ImageRecord = {
        id: uid(),
        projectId,
        sortOrder: images.length,
        source: img.provider,
        caption: null,
        captionEdited: false,
        takenAt: null,
        stored: null,
        analysis: null,
        thumb: null,
        externalUrl: null,
        externalThumbUrl: null,
        width: img.width,
        height: img.height,
        attribution: { provider: img.provider, author: img.author, authorUrl: img.authorUrl, pageUrl: img.pageUrl },
        visualFacts: [],
        hasPeople: false,
        createdAt: now(),
      };
      if (img.provider === "pixabay") {
        // Pixabay: 직접 링크하지 않고 내려받아 저장 (명세서 27.2)
        const processed = await processRemoteBlob(await api.pixabayImage(img.url));
        Object.assign(base, processed);
      } else {
        // Unsplash: 제공 URL 그대로 사용 + 다운로드 추적 (명세서 27.3)
        base.externalUrl = img.url;
        base.externalThumbUrl = img.thumbUrl;
        if (img.downloadLocation) await api.trackUnsplash(img.downloadLocation);
      }
      await putImage(base);
      if (experience) await reorderImages(projectId, [base.id, ...images.map((i) => i.id)]);
      toast("참고 이미지를 추가했습니다.", "success");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "이미지를 추가하지 못했습니다.", "alert");
    } finally {
      setAdding(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="참고 이미지 검색" wide>
      <div className="space-y-4">
        <Notice tone={experience ? "warning" : "info"}>
          {experience
            ? "경험형 콘텐츠에서는 참고 이미지를 커버 1장으로만 쓸 수 있고, 실제 경험 사진(음식·매장·제품 실물)을 대신할 수 없습니다."
            : "정보형 콘텐츠에서는 본문 보조 이미지로 쓸 수 있습니다."}{" "}
          참고 이미지에는 &lsquo;참고 이미지&rsquo; 표시와 출처가 자동으로 붙고, 사진 분석(Visual Fact)에는 쓰지 않습니다.
        </Notice>
        {blocked ? (
          <p className="text-sm text-muted">{experience ? "이미 커버용 참고 이미지가 있습니다." : `사진은 최대 ${MAX_PHOTOS}장입니다.`}</p>
        ) : (
          <>
            <form onSubmit={search} className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 카페 인테리어, 노트북 작업" className="h-11 flex-1 rounded-[10px] border border-line px-3 text-sm outline-none focus:border-accent" aria-label="검색어" />
              <Button type="submit" icon={<Search className="size-4" />} loading={loading}>
                검색
              </Button>
            </form>
            {loading && <Spinner className="mx-auto" />}
            {results && !results.length && <p className="text-sm text-muted">결과가 없습니다.</p>}
            {results && results.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {results.map((img) => (
                  <li key={`${img.provider}-${img.id}`}>
                    <button type="button" className="group block w-full overflow-hidden rounded-[10px] border border-line text-left" onClick={() => pick(img)} disabled={!!adding}>
                      <img src={img.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-90" loading="lazy" />
                      <span className="block truncate px-2 py-1.5 text-[11px] text-muted">
                        {adding === img.id ? "추가 중…" : `${img.author} · ${img.provider === "unsplash" ? "Unsplash" : "Pixabay"}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
