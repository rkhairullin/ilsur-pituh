import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: [
        "ilsur-lovit-chleny/index.html",
        "ilsur-lovit-chleny/instructions.html",
        "maze/index.html",
      ].map((page) =>
        fileURLToPath(new URL(`./client/games/${page}`, import.meta.url)),
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
});
