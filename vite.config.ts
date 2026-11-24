import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";
// The shared development plugin is plain ESM and intentionally has no TS declarations.
// @ts-expect-error JavaScript-only Vite plugin
import adminPlugin from "../frontend/adminPlugin.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), cesium(), adminPlugin({ geoaiUrl: env.GEOAI_URL })],
    optimizeDeps: {
      exclude: ["cesium"],
      // Cesium's Math module imports this legacy CommonJS package as a
      // default export. Without pre-bundling, the Vite dev server exposes the
      // raw file as ESM and the lazy-loaded globe fails at runtime.
      include: ["mersenne-twister"],
      needsInterop: ["mersenne-twister"],
    },
    server: {
      port: 5174,
      allowedHosts: [".ts.net"],
      proxy: {
        // The deployed geoportal exposes the authenticated GeoAI relay. Keep
        // it same-origin in C2 so no internal token is sent to the browser.
        "/__geoai": {
          target: env.DEV_PROXY_GEOAI || "http://192.168.2.55",
          changeOrigin: true,
          timeout: 180_000,
          proxyTimeout: 180_000,
        },
        "/geoserver": { target: env.DEV_PROXY_GEOSERVER || "http://192.168.2.37", changeOrigin: true },
        "/catalog-api": {
          target: env.DEV_PROXY_CATALOG || "http://192.168.2.52",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/catalog-api/, ""),
        },
      },
    },
  };
});
