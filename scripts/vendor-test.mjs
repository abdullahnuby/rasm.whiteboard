import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
const manifest = JSON.parse(await readFile("dist/vendor/dependencies.json", "utf8"));
assert.equal(manifest.paper.version, "0.17.0");
assert.ok(manifest.paper.bytes > 80_000);
for (const file of ["paper-core.js", "THIRD-PARTY-LICENSES.md"]) {
  assert.ok((await stat("dist/vendor/" + file)).size > 100, file + " must be bundled locally");
}
assert.ok(!("opencv" in manifest), "Unused OpenCV must not inflate the production bundle.");
console.log("RASM local Paper.js dependency passed.");
