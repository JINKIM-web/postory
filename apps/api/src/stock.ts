import type { StockImage } from "@postory/shared";
import { config } from "./config.js";

// 스톡 이미지 (Phase 1C, 명세서 8.3, 27.2~27.3)
// Pixabay: 이미지를 내려받아 자체 저장(로컬 MVP에서는 브라우저 IndexedDB)해야 하므로 다운로드 프록시를 둔다.
// Unsplash: 제공 URL을 그대로 쓰고, 사용자가 선택하면 다운로드 추적 엔드포인트를 호출한다.

const utm = () => `utm_source=${encodeURIComponent(config.unsplashAppName)}&utm_medium=referral`;

export async function searchPixabay(query: string): Promise<StockImage[]> {
  if (!config.pixabayKey) return [];
  const url = new URL("https://pixabay.com/api/");
  url.search = new URLSearchParams({ key: config.pixabayKey, q: query, image_type: "photo", lang: "ko", per_page: "20", safesearch: "true" }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay 검색 실패 (${res.status})`);
  const body = (await res.json()) as { hits: any[] };
  return body.hits.map((h) => ({
    provider: "pixabay",
    id: String(h.id),
    thumbUrl: h.webformatURL,
    url: h.largeImageURL ?? h.webformatURL,
    width: h.imageWidth,
    height: h.imageHeight,
    author: h.user,
    authorUrl: `https://pixabay.com/users/${h.user}-${h.user_id}/`,
    pageUrl: h.pageURL,
    downloadLocation: null,
  }));
}

export async function searchUnsplash(query: string, orientation?: "landscape" | "squarish"): Promise<StockImage[]> {
  if (!config.unsplashKey) return [];
  const url = new URL("https://api.unsplash.com/search/photos");
  url.search = new URLSearchParams({ query, per_page: "20", content_filter: "high", ...(orientation ? { orientation } : {}) }).toString();
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${config.unsplashKey}`, "Accept-Version": "v1" } });
  if (!res.ok) throw new Error(`Unsplash 검색 실패 (${res.status})`);
  const body = (await res.json()) as { results: any[] };
  return body.results.map((p) => ({
    provider: "unsplash",
    id: p.id,
    thumbUrl: p.urls.small,
    url: p.urls.regular,
    width: p.width,
    height: p.height,
    author: p.user.name,
    authorUrl: `${p.user.links.html}?${utm()}`,
    pageUrl: `${p.links.html}?${utm()}`,
    downloadLocation: p.links.download_location,
  }));
}

export async function trackUnsplashDownload(downloadLocation: string): Promise<void> {
  const url = new URL(downloadLocation);
  if (url.hostname !== "api.unsplash.com") throw new Error("허용되지 않은 주소입니다.");
  await fetch(url, { headers: { Authorization: `Client-ID ${config.unsplashKey}` } });
}

export async function fetchPixabayImage(imageUrl: string): Promise<{ body: ArrayBuffer; type: string }> {
  const url = new URL(imageUrl);
  if (!/(^|\.)pixabay\.com$/.test(url.hostname)) throw new Error("허용되지 않은 주소입니다.");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 (${res.status})`);
  return { body: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "image/jpeg" };
}

// 대표 카드 합성용: 브라우저 캔버스가 Unsplash 이미지를 읽을 수 있도록 같은 출처로 중계한다 (저장하지 않음)
export async function fetchUnsplashImage(imageUrl: string): Promise<{ body: ArrayBuffer; type: string }> {
  const url = new URL(imageUrl);
  if (url.hostname !== "images.unsplash.com") throw new Error("허용되지 않은 주소입니다.");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 (${res.status})`);
  return { body: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "image/jpeg" };
}
