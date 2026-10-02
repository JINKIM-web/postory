import exifr from "exifr";
import { ANALYSIS_IMAGE_LONG_EDGE, MAX_PHOTO_BYTES, STORED_IMAGE_LONG_EDGE, THUMBNAIL_LONG_EDGE } from "@postory/shared";
import { now, uid } from "./db";
import type { ImageRecord } from "./types";

// 업로드 처리 (명세서 32.2): 형식·용량·시그니처 검증 → EXIF 촬영일시 추출 → 재인코딩으로 EXIF 전체 제거(GPS 포함)
// → 저장본·분석본·썸네일 생성. 원본 파일은 저장하지 않는다.

export class UploadError extends Error {}

async function detectType(file: File): Promise<"jpeg" | "png" | "webp" | "heic" | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|mif1|msf1|heim|heis)$/.test(ascii(8, 12))) return "heic";
  return null;
}

const EXTENSIONS: Record<string, string[]> = {
  jpeg: ["jpg", "jpeg"],
  png: ["png"],
  webp: ["webp"],
  heic: ["heic", "heif"],
};

async function readTakenAt(file: File): Promise<string | null> {
  try {
    // GPS는 읽지 않는다
    const data = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"], gps: false, tiff: true, exif: true });
    const date: unknown = data?.DateTimeOriginal ?? data?.CreateDate;
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  } catch {
    return null;
  }
}

function canvasBlob(bitmap: ImageBitmap, longEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new UploadError("이미지를 변환하지 못했습니다."))), "image/jpeg", quality),
  );
}

export async function processUpload(file: File, projectId: string, sortOrder: number): Promise<ImageRecord> {
  if (file.size > MAX_PHOTO_BYTES) throw new UploadError(`${file.name}: 파일이 너무 큽니다 (최대 ${MAX_PHOTO_BYTES / 1024 / 1024}MB).`);
  const type = await detectType(file);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!type || !EXTENSIONS[type]!.includes(ext) || (file.type && !file.type.startsWith("image/"))) {
    throw new UploadError(`${file.name}: JPG, PNG, WEBP, HEIC 이미지만 올릴 수 있습니다.`);
  }

  const takenAt = await readTakenAt(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UploadError(
      type === "heic"
        ? `${file.name}: 이 브라우저는 HEIC를 열 수 없습니다. 사진 앱에서 JPG로 내보낸 뒤 올려 주세요.`
        : `${file.name}: 이미지를 열 수 없습니다.`,
    );
  }

  try {
    const [stored, analysis, thumb] = await Promise.all([
      canvasBlob(bitmap, STORED_IMAGE_LONG_EDGE, 0.88),
      canvasBlob(bitmap, ANALYSIS_IMAGE_LONG_EDGE, 0.8),
      canvasBlob(bitmap, THUMBNAIL_LONG_EDGE, 0.8),
    ]);
    const scale = Math.min(1, STORED_IMAGE_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    return {
      id: uid(),
      projectId,
      sortOrder,
      source: "user",
      caption: null,
      captionEdited: false,
      takenAt,
      stored,
      analysis,
      thumb,
      externalUrl: null,
      externalThumbUrl: null,
      width: Math.round(bitmap.width * scale),
      height: Math.round(bitmap.height * scale),
      attribution: null,
      visualFacts: [],
      hasPeople: false,
      createdAt: now(),
    };
  } finally {
    bitmap.close();
  }
}

// 외부에서 받은 이미지(Pixabay)를 같은 방식으로 저장본·썸네일로 만든다
export async function processRemoteBlob(blob: Blob): Promise<{ stored: Blob; thumb: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const [stored, thumb] = await Promise.all([canvasBlob(bitmap, STORED_IMAGE_LONG_EDGE, 0.88), canvasBlob(bitmap, THUMBNAIL_LONG_EDGE, 0.8)]);
    const scale = Math.min(1, STORED_IMAGE_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    return { stored, thumb, width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) };
  } finally {
    bitmap.close();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function formatTakenDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function isoDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
