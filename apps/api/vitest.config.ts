import { defineConfig } from "vitest/config";

// 테스트는 .env.local에 키가 있어도 항상 Mock으로 실행한다 (OpenAI 비용 방지)
export default defineConfig({
  test: { env: { POSTORY_MOCK: "1" } },
});
