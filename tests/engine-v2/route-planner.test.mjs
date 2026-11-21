import test from "node:test";
import assert from "node:assert/strict";
import { routeElementStrokes } from "../../.build/index.js";

function referenceRoute(strokes, direction) {
  if (strokes.length <= 1) {
    if (!strokes.length) return [];
    const only = strokes[0], a = only.points[0], b = only.points.at(-1);
    const reverse = direction === "rtl" ? b[0] > a[0] : b[0] < a[0];
    return [reverse ? { ...only, points: only.points.slice().reverse() } : { ...only, points: only.points.slice() }];
  }
  const rtl = direction === "rtl", remaining = new Set(strokes.map((_, index) => index));
  const ordered = [];
  let firstIndex = -1, firstReverse = false, firstScore = Infinity;
  for (let index = 0; index < strokes.length; index++) for (const reverse of [false, true]) {
    const point = reverse ? strokes[index].points.at(-1) : strokes[index].points[0];
    const score = (rtl ? -point[0] : point[0]) * 10000 + point[1] * 0.01 + index * 1e-7;
    if (score < firstScore) { firstScore = score; firstIndex = index; firstReverse = reverse; }
  }
  const first = strokes[firstIndex];
  ordered.push(firstReverse ? { ...first, points: first.points.slice().reverse() } : { ...first, points: first.points.slice() });
  remaining.delete(firstIndex);
  let cursor = ordered[0].points.at(-1);
  while (remaining.size) {
    let chosen = -1, reverseChosen = false, bestDistance = Infinity;
    for (const index of remaining) for (const reverse of [false, true]) {
      const point = reverse ? strokes[index].points.at(-1) : strokes[index].points[0];
      const distance = Math.hypot(cursor[0] - point[0], cursor[1] - point[1]);
      if (distance < bestDistance) { bestDistance = distance; chosen = index; reverseChosen = reverse; }
    }
    const next = strokes[chosen];
    const routed = reverseChosen ? { ...next, points: next.points.slice().reverse() } : { ...next, points: next.points.slice() };
    ordered.push(routed); remaining.delete(chosen); cursor = routed.points.at(-1);
  }
  return ordered;
}

test("spatial endpoint routing preserves the old greedy route for ordinary drawings", () => {
  let seed = 0x12345678;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  for (const direction of ["rtl", "ltr"]) {
    for (let pass = 0; pass < 20; pass++) {
      const strokes = Array.from({ length: 30 + pass }, (_, index) => {
        const x = random() * 500, y = random() * 300;
        return { id: "s" + index, points: [[x, y], [x + random() * 8, y + random() * 8]] };
      });
      const actual = routeElementStrokes(strokes, direction);
      const expected = referenceRoute(strokes, direction);
      assert.deepEqual(actual.map(stroke => [stroke.id, stroke.points]), expected.map(stroke => [stroke.id, stroke.points]));
    }
  }
});

test("spatial endpoint routing scales to thousands of disconnected strokes", () => {
  const strokes = Array.from({ length: 6000 }, (_, index) => {
    const x = (index % 120) * 17, y = Math.floor(index / 120) * 19;
    return { id: "stress-" + index, points: [[x, y], [x + 3, y + 2]] };
  });
  const started = performance.now();
  const routed = routeElementStrokes(strokes, "rtl");
  const elapsed = performance.now() - started;
  assert.equal(routed.length, strokes.length);
  assert.equal(new Set(routed.map(stroke => stroke.id)).size, strokes.length);
  assert.ok(elapsed < 8000, "6,000-stroke routing exceeded the 8-second regression budget: " + elapsed.toFixed(1) + "ms");
});

test("coincident junction endpoints are bucketed instead of rescanned quadratically", () => {
  const strokes = Array.from({ length: 4000 }, (_, index) => ({
    id: "junction-" + index,
    points: [[0, 0], [index + 1, (index % 29) * 0.25 + 1]]
  }));
  const started = performance.now();
  const routed = routeElementStrokes(strokes, "rtl");
  const elapsed = performance.now() - started;
  assert.equal(routed.length, strokes.length);
  assert.equal(new Set(routed.map(stroke => stroke.id)).size, strokes.length);
  assert.ok(elapsed < 8000, "4,000 coincident-junction strokes exceeded the 8-second regression budget: " + elapsed.toFixed(1) + "ms");
});
