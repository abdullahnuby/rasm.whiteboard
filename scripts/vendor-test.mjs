import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
const manifest = JSON.parse(await readFile("dist/vendor/dependencies.json", "utf8"));
assert.equal(manifest.opencv.version, "5.0.0-release.1");
assert.equal(manifest.paper.version, "0.17.0");
assert.ok(manifest.opencv.bytes > 8_000_000);
assert.ok(manifest.paper.bytes > 80_000);
for (const file of ["opencv.js", "paper-core.js", "THIRD-PARTY-LICENSES.md"]) {
  assert.ok((await stat("dist/vendor/" + file)).size > 100, file + " must be bundled locally");
}
console.log("RASM local OpenCV.js and Paper.js dependencies passed.");
