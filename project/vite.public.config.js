import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./public-archive", import.meta.url)),
  base: "/cdlhs/",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./dist-public", import.meta.url)),
    emptyOutDir: true,
  },
});
