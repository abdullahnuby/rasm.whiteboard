import { boundsOfPoints, distance } from "./geometry.js";
import type { Direction, ElementPlan, ElementRecord, Point, Rect, StrokePath } from "./types.js";

function startEndpoint(stroke: StrokePath, reverse: boolean): Point {
  return reverse ? stroke.points[stroke.points.length - 1] : stroke.points[0];
}

export function routeElementStrokes(strokes: readonly StrokePath[], direction: Direction): StrokePath[] {
  if (strokes.length <= 1) {
    if (!strokes.length) return [];
    const only = strokes[0];
    const a = only.points[0], b = only.points[only.points.length - 1];
    const reverse = direction === "rtl" ? b[0] > a[0] : b[0] < a[0];
    return [reverse ? { ...only, points: only.points.slice().reverse() } : { ...only, points: only.points.slice() }];
  }
  const rtl = direction === "rtl", remaining = new Set(strokes.map((_, index) => index));
  const ordered: StrokePath[] = [];
  let firstIndex = -1, firstReverse = false, firstScore = Infinity;
  for (let index = 0; index < strokes.length; index++) for (const reverse of [false, true]) {
    const point = startEndpoint(strokes[index], reverse);
    const score = (rtl ? -point[0] : point[0]) * 10000 + point[1] * 0.01 + index * 1e-7;
    if (score < firstScore) { firstScore = score; firstIndex = index; firstReverse = reverse; }
  }
  const first = strokes[firstIndex];
  ordered.push(firstReverse ? { ...first, points: first.points.slice().reverse() } : { ...first, points: first.points.slice() });
  remaining.delete(firstIndex);
  let cursor = ordered[0].points[ordered[0].points.length - 1];
  while (remaining.size) {
    let chosen = -1, reverseChosen = false, bestDistance = Infinity;
    for (const index of remaining) for (const reverse of [false, true]) {
      const point = startEndpoint(strokes[index], reverse), d = distance(cursor, point);
      if (d < bestDistance) { bestDistance = d; chosen = index; reverseChosen = reverse; }
    }
    const next = strokes[chosen];
    const routed = reverseChosen ? { ...next, points: next.points.slice().reverse() } : { ...next, points: next.points.slice() };
    ordered.push(routed);
    remaining.delete(chosen);
    cursor = routed.points[routed.points.length - 1];
  }
  return ordered;
}

function makeRows<T extends { bounds: Rect }>(items: T[]): T[][] {
  const sorted = items.slice().sort((a, b) => a.bounds.cy - b.bounds.cy);
  const rows: Array<{ cy: number; height: number; items: T[] }> = [];
  for (const item of sorted) {
    const threshold = Math.max(7, Math.min(30, Math.max(10, item.bounds.height) * 0.48));
    let row = rows.find(candidate => Math.abs(candidate.cy - item.bounds.cy) <= Math.max(threshold, candidate.height * 0.42));
    if (!row) { row = { cy: item.bounds.cy, height: item.bounds.height, items: [] }; rows.push(row); }
    row.items.push(item);
    const count = row.items.length;
    row.cy = (row.cy * (count - 1) + item.bounds.cy) / count;
    row.height = Math.max(row.height, item.bounds.height);
  }
  return rows.sort((a, b) => a.cy - b.cy).map(row => row.items);
}

export function orderElements(
  elements: readonly ElementRecord[],
  direction: Direction,
  zones: readonly { x: number; y: number; w: number; h: number }[] = []
): ElementRecord[] {
  const orderedRows = makeRows(elements.map(element => ({ ...element })));
  const readingOrder = orderedRows.flatMap(row =>
    row.sort((a, b) => direction === "rtl" ? b.bounds.cx - a.bounds.cx : a.bounds.cx - b.bounds.cx)
  );
  if (!zones.length) return readingOrder;
  const zoneIndex = (element: ElementRecord) => {
    const x = element.bounds.cx, y = element.bounds.cy;
    return zones.findIndex(zone =>
      x >= zone.x && y >= zone.y && x <= zone.x + zone.w && y <= zone.y + zone.h
    );
  };
  return readingOrder.slice().sort((a, b) => {
    const za = zoneIndex(a), zb = zoneIndex(b);
    if (za < 0 && zb < 0) return a.orderIndex - b.orderIndex;
    if (za < 0) return 1;
    if (zb < 0) return -1;
    return za - zb || a.orderIndex - b.orderIndex;
  });
}

export function finalizeElements(
  elements: readonly ElementRecord[],
  direction: Direction,
  zones: readonly { x: number; y: number; w: number; h: number }[] = []
): { elements: ElementPlan[]; lines: StrokePath[]; length: number; totalDistance: number } {
  const ordered = orderElements(elements, direction, zones);
  const plans: ElementPlan[] = [], lines: StrokePath[] = [];
  let pointOffset = 0, travelled = 0, previous: Point | null = null;
  ordered.forEach((element, orderIndex) => {
    const strokes = routeElementStrokes(element.strokes, direction);
    const startDistance = travelled;
    for (const stroke of strokes) {
      const first = stroke.points[0], last = stroke.points[stroke.points.length - 1];
      if (previous) travelled += distance(previous, first); // pen-up travel consumes time but draws nothing
      // Precompute per-stroke distance samples in the Worker. The animation
      // thread can then find the pen position without rebuilding O(points) tables.
      const cumulative = new Float32Array(stroke.points.length);
      for (let index = 1; index < stroke.points.length; index++) {
        cumulative[index] = cumulative[index - 1] + distance(stroke.points[index - 1], stroke.points[index]);
      }
      travelled += cumulative[cumulative.length - 1] || 0;
      const finalized: StrokePath = {
        ...stroke, elementId: element.id, shapeId: element.id,
        start: pointOffset, cumulative
      };
      lines.push(finalized);
      pointOffset += stroke.points.length;
      previous = last;
    }
    plans.push({
      id: element.id, componentIds: element.componentIds.slice(), bounds: { ...element.bounds },
      area: element.area, orderIndex, strokes, diagnostics: element.diagnostics,
      startDistance, endDistance: travelled
    });
  });
  return { elements: plans, lines, length: pointOffset, totalDistance: travelled };
}

export function elementBounds(strokes: readonly StrokePath[], fallback: Rect): Rect {
  const points = strokes.flatMap(stroke => stroke.points);
  return points.length ? boundsOfPoints(points) : { ...fallback };
}
