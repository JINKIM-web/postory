import { ImageOff } from "lucide-react";
import { useObjectUrl } from "../lib/hooks";
import type { ImageRecord } from "../lib/types";
import { cx } from "./ui";

export function PhotoThumb({ image, className, alt, full }: { image: ImageRecord | undefined; className?: string; alt?: string; full?: boolean }) {
  const blobUrl = useObjectUrl(full ? (image?.stored ?? image?.thumb) : image?.thumb);
  const src = blobUrl ?? (full ? image?.externalUrl : image?.externalThumbUrl) ?? null;
  if (!src) {
    return (
      <div className={cx("grid place-items-center bg-subtle text-muted", className)}>
        <ImageOff className="size-5" aria-hidden />
      </div>
    );
  }
  return <img src={src} alt={alt ?? image?.caption ?? "사진"} className={cx("object-cover", className)} loading="lazy" />;
}
