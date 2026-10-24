import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET?.trim();

  return {
    plugins: [react()],
    server: {
      proxy: proxyTarget
        ? {
            "/triage": { target: proxyTarget, changeOrigin: true },
            "/providers": { target: proxyTarget, changeOrigin: true },
            "/health": { target: proxyTarget, changeOrigin: true },
          }
        : undefined,
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true,
    },
  };
});
