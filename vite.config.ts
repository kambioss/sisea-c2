import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Same GeoServer proxy as apps/frontend: the cluster WMS is reachable on the
// OSS network; from outside set DEV_PROXY_GEOSERVER to an SSH tunnel.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    server: {
      port: 5174,
      allowedHosts: [".ts.net"],
      proxy: {
        "/geoserver": { target: env.DEV_PROXY_GEOSERVER || "http://192.168.2.37", changeOrigin: true },
      },
    },
  };
});
