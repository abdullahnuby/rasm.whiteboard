import { mkdir, copyFile, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const destination = resolve(root, "dist/vendor");
await mkdir(destination, { recursive: true });

async function copyFirst(candidates, target, minimumBytes) {
  let selected = null;
  for (const candidate of candidates) {
    try {
      const info = await stat(resolve(root, candidate));
      if (info.isFile() && info.size >= minimumBytes) { selected = candidate; break; }
    } catch { /* try next published distribution */ }
  }
  if (!selected) throw new Error("Required local browser dependency missing: " + candidates.join(" or "));
  const targetPath = resolve(destination, target);
  await copyFile(resolve(root, selected), targetPath);
  const data = await readFile(targetPath);
  return { file: target, source: selected, bytes: data.byteLength, sha256: createHash("sha256").update(data).digest("hex") };
}

const paper = await copyFirst([
  "node_modules/paper/dist/paper-core.min.js",
  "node_modules/paper/dist/paper-core.js",
  "node_modules/paper/dist/paper-full.min.js",
  "node_modules/paper/dist/paper-full.js"
], "paper-core.js", 80_000);

async function license(candidates) {
  for (const candidate of candidates) {
    try { const content = await readFile(resolve(root, candidate), "utf8"); if (content.trim()) return content; } catch { /* continue */ }
  }
  throw new Error("Third-party license file missing: " + candidates.join(" or "));
}

const paperLicense = await license(["node_modules/paper/LICENSE.txt", "node_modules/paper/LICENSE"]);
await writeFile(resolve(destination, "THIRD-PARTY-LICENSES.md"),
  "# Third-party browser engines\n\n## Paper.js 0.17.0 — MIT\n\n" + paperLicense);
const manifest = {
  paper: { version: "0.17.0", license: "MIT", ...paper }
};
await writeFile(resolve(destination, "dependencies.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("RASM local browser dependencies vendored:", JSON.stringify({ paper: paper.bytes }));
