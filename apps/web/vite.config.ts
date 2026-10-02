import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5173은 다른 로컬 프로젝트와 겹치지 않도록 피한다
    port: 5180,
    // API_PORT로 다른 API 서버(예: 테스트용 Mock)에 붙일 수 있다
    proxy: { "/api": `http://localhost:${process.env.API_PORT ?? 8787}` },
  },
});
