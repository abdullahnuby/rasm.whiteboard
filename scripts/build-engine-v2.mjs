import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir(".build", { recursive: true });
const common = {
  entryPoints: ["src/engine-v2/index.ts"],
  bundle: true,
  sourcemap: true,
  target: ["es2020"],
  logLevel: "info"
};
await Promise.all([
  build({
    ...common,
    outfile: "dist/engine-v2.js",
    format: "iife",
    globalName: "RasmWhiteboardCore",
    platform: "browser"
  }),
  build({
    ...common,
    outfile: ".build/index.js",
    format: "esm",
    platform: "node",
    target: ["node20"]
  })
]);
console.log("RASM Engine v2 browser bundle and Node test bundle built.");
