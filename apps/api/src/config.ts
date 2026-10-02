import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

// 환경 변수. OPENAI_API_KEY가 없으면 Mock 모드로 동작한다 (로컬 개발·데모용).
// tsx watch가 다시 시작할 때 --env-file이 적용되지 않으므로 코드에서 직접 읽는다.
// 우선순위: 실행 환경에서 직접 준 값 > .env.local > .env
const apiRoot = fileURLToPath(new URL("..", import.meta.url));
for (const file of [".env.local", ".env"]) {
  const path = `${apiRoot}${file}`;
  if (!existsSync(path)) continue;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(path, "utf8")))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  // 미결 #4 — 모델 선정 전 기본값. 분류·점검은 경량, 본문은 상위 모델 (명세서 27.1)
  modelLight: process.env.OPENAI_MODEL_LIGHT ?? "gpt-5-mini",
  modelMain: process.env.OPENAI_MODEL_MAIN ?? "gpt-5",
  // 1M 토큰당 USD — UsageLog의 추정 비용 계산용. 실제 단가로 바꿔 쓴다.
  price: {
    light: { input: Number(process.env.PRICE_LIGHT_INPUT ?? 0.25), output: Number(process.env.PRICE_LIGHT_OUTPUT ?? 2) },
    main: { input: Number(process.env.PRICE_MAIN_INPUT ?? 1.25), output: Number(process.env.PRICE_MAIN_OUTPUT ?? 10) },
  },
  // gpt-5 계열은 긴 본문에서 90초를 넘기기도 한다 (골든셋 평가 결과)
  requestTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 180_000),
  // 추론 모델(gpt-5·o 시리즈)의 추론 강도 — 낮출수록 빠르고 저렴하다
  reasoningEffort: {
    light: process.env.OPENAI_REASONING_LIGHT ?? "minimal",
    main: process.env.OPENAI_REASONING_MAIN ?? "low",
  },
  pixabayKey: process.env.PIXABAY_API_KEY ?? "",
  unsplashKey: process.env.UNSPLASH_ACCESS_KEY ?? "",
  // Unsplash 출처 링크의 utm_source (가이드라인상 앱 이름)
  unsplashAppName: process.env.UNSPLASH_APP_NAME || "postory",
  allowedOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5180",
};

// POSTORY_MOCK=1: 키가 있어도 Mock으로 실행 (자동 테스트에서 비용이 나가지 않게)
export const isMock = () => !config.openaiApiKey || process.env.POSTORY_MOCK === "1";
