import type {
  AnalyzeVoiceRequest,
  AnalyzeVoiceResponse,
  AnalyzeImagesRequest,
  AnalyzeImagesResponse,
  CheckMissingRequest,
  CheckMissingResponse,
  ComposeStoryRequest,
  ComposeStoryResponse,
  HealthResponse,
  OrganizeMemoryRequest,
  OrganizeMemoryResponse,
  ReviewRequest,
  ReviewResponse,
  RewriteRequest,
  RewriteResponse,
  StockImage,
  WriteRequest,
  WriteResponse,
} from "@postory/shared";

export class ApiError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError("AI 서버에 연결할 수 없습니다. API 서버가 실행 중인지 확인하세요.", true);
  }
  if (!res.ok) {
    let body: { error?: string; retryable?: boolean } = {};
    try {
      body = await res.json();
    } catch {
      // 본문 없는 오류
    }
    throw new ApiError(body.error ?? `요청에 실패했습니다 (${res.status}).`, body.retryable ?? res.status >= 500);
  }
  return res.json() as Promise<T>;
}

const post = <Req, Res>(path: string) => (body: Req) => request<Res>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  health: () => request<HealthResponse>("/api/health"),
  analyzeImages: post<AnalyzeImagesRequest, AnalyzeImagesResponse>("/api/stages/analyze-images"),
  organizeMemory: post<OrganizeMemoryRequest, OrganizeMemoryResponse>("/api/stages/organize-memory"),
  checkMissing: post<CheckMissingRequest, CheckMissingResponse>("/api/stages/check-missing"),
  composeStory: post<ComposeStoryRequest, ComposeStoryResponse>("/api/stages/compose-story"),
  write: post<WriteRequest, WriteResponse>("/api/stages/write"),
  review: post<ReviewRequest, ReviewResponse>("/api/stages/review"),
  rewrite: post<RewriteRequest, RewriteResponse>("/api/rewrite"),
  analyzeVoice: post<AnalyzeVoiceRequest, AnalyzeVoiceResponse>("/api/voice/analyze"),
  stockSearch: (q: string, provider?: "unsplash") => request<{ images: StockImage[] }>(`/api/stock/search?q=${encodeURIComponent(q)}${provider ? `&provider=${provider}` : ""}`),
  trackUnsplash: (downloadLocation: string) => request<{ ok: boolean }>("/api/stock/unsplash/track", { method: "POST", body: JSON.stringify({ downloadLocation }) }),
  pixabayImage: async (url: string): Promise<Blob> => {
    const res = await fetch(`/api/stock/pixabay/image?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new ApiError("이미지를 내려받지 못했습니다.", true);
    return res.blob();
  },
};
