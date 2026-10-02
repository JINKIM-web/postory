import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import type { z } from "zod";
import {
  AnalyzeImagesRequest,
  AnalyzeVoiceRequest,
  CheckMissingRequest,
  ComposeStoryRequest,
  OrganizeMemoryRequest,
  ReviewRequest,
  RewriteRequest,
  WriteRequest,
  type HealthResponse,
} from "@postory/shared";
import { config, isMock } from "./config.js";
import { LlmError } from "./llm.js";
import { analyzeImages, checkMissing, organizeMemory } from "./stages/analyze.js";
import { review } from "./stages/review.js";
import { rewrite } from "./stages/rewrite.js";
import { composeStory } from "./stages/story.js";
import { analyzeVoice } from "./stages/voice.js";
import { writeChannel } from "./stages/write.js";
import { fetchPixabayImage, fetchUnsplashImage, searchPixabay, searchUnsplash, trackUnsplashDownload } from "./stock.js";

// 로컬 MVP API: 상태를 저장하지 않는 AI 프록시. OpenAI 키는 이 서버에만 둔다 (명세서 40.3).

const app = express();
app.use(cors({ origin: config.allowedOrigin }));
// 분석용 저해상도 이미지(base64) 최대 10장
app.use(express.json({ limit: "30mb" }));

class BadRequest extends Error {}

function route<S extends z.ZodType, R>(schema: S, handler: (body: z.infer<S>) => Promise<R>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) throw new BadRequest(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
      res.json(await handler(parsed.data));
    } catch (err) {
      next(err);
    }
  };
}

app.get("/api/health", (_req, res) => {
  const body: HealthResponse = { mode: isMock() ? "mock" : "openai", stock: { pixabay: !!config.pixabayKey, unsplash: !!config.unsplashKey } };
  res.json(body);
});

app.post("/api/stages/analyze-images", route(AnalyzeImagesRequest, analyzeImages));
app.post("/api/stages/organize-memory", route(OrganizeMemoryRequest, organizeMemory));
app.post("/api/stages/check-missing", route(CheckMissingRequest, checkMissing));
app.post("/api/stages/compose-story", route(ComposeStoryRequest, composeStory));
app.post("/api/stages/write", route(WriteRequest, writeChannel));
app.post("/api/stages/review", route(ReviewRequest, review));
app.post("/api/rewrite", route(RewriteRequest, rewrite));
app.post("/api/voice/analyze", route(AnalyzeVoiceRequest, analyzeVoice));

app.get("/api/stock/search", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) throw new BadRequest("검색어를 입력하세요.");
    // provider=unsplash: 대표 카드용 (가로형 우선)
    if (req.query.provider === "unsplash") {
      res.json({ images: await searchUnsplash(q, "landscape") });
      return;
    }
    const [pixabay, unsplash] = await Promise.all([searchPixabay(q), searchUnsplash(q)]);
    res.json({ images: [...unsplash, ...pixabay] });
  } catch (err) {
    next(err);
  }
});

app.post("/api/stock/unsplash/track", async (req, res, next) => {
  try {
    await trackUnsplashDownload(String(req.body?.downloadLocation ?? ""));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get("/api/stock/unsplash/image", async (req, res, next) => {
  try {
    const { body, type } = await fetchUnsplashImage(String(req.query.url ?? ""));
    res.type(type).send(Buffer.from(body));
  } catch (err) {
    next(err);
  }
});

app.get("/api/stock/pixabay/image", async (req, res, next) => {
  try {
    const { body, type } = await fetchPixabayImage(String(req.query.url ?? ""));
    res.type(type).send(Buffer.from(body));
  } catch (err) {
    next(err);
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof BadRequest) {
    res.status(400).json({ error: err.message, retryable: false });
    return;
  }
  if (err instanceof LlmError) {
    res.status(502).json({ error: err.message, retryable: err.retryable });
    return;
  }
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : "서버 오류가 발생했습니다.", retryable: true });
});

app.listen(config.port, () => {
  console.log(`POSTORY API → http://localhost:${config.port} (${isMock() ? "Mock 모드: OPENAI_API_KEY 없음" : `OpenAI: ${config.modelLight} / ${config.modelMain}`})`);
});
