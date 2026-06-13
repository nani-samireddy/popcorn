import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  noExternal: ["@popcorn/shared"],
  outDir: "dist",
  platform: "node",
  target: "es2022",
});
