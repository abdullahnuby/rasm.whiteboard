import { boundsOfPoints, distance } from "./geometry.js";
import type { Direction, ElementPlan, ElementRecord, Point, Rect, StrokePath } from "./types.js";

function startEndpoint(stroke: StrokePath, reverse: boolean): Point {
  return reverse ? stroke.points[stroke.points.length - 1] : stroke.points[0];
}

interface Endpoint {
  x: number;
  y: number;
  strokeIndex: number;
  reverse: boolean;
}
interface EndpointBucket {
  x: number;
  y: number;
  entries: Endpoint[];
  cursor: number;
}
interface EndpointNode extends EndpointBucket {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  left: EndpointNode | null;
  right: EndpointNode | null;
}

function buildEndpointTree(items: EndpointBucket[]): EndpointNode | null {
  if (!items.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.x); maxX = Math.max(maxX, item.x);
    minY = Math.min(minY, item.y); maxY = Math.max(maxY, item.y);
  }
  const axis = maxX - minX >= maxY - minY ? "x" : "y";
  items.sort((a, b) => a[axis] - b[axis] || a[axis === "x" ? "y" : "x"] - b[axis === "x" ? "y" : "x"]);
  const middle = items.length >> 1, point = items[middle];
  const left = buildEndpointTree(items.slice(0, middle));
  const right = buildEndpointTree(items.slice(middle + 1));
  return {
    ...point, left, right,
    minX: Math.min(point.x, left?.minX ?? Infinity, right?.minX ?? Infinity),
    maxX: Math.max(point.x, left?.maxX ?? -Infinity, right?.maxX ?? -Infinity),
    minY: Math.min(point.y, left?.minY ?? Infinity, right?.minY ?? Infinity),
    maxY: Math.max(point.y, left?.maxY ?? -Infinity, right?.maxY ?? -Infinity)
  };
}

function distanceToBounds(point: Point, node: EndpointNode): number {
  const dx = point[0] < node.minX ? node.minX - point[0] : point[0] > node.maxX ? point[0] - node.maxX : 0;
  const dy = point[1] < node.minY ? node.minY - point[1] : point[1] > node.maxY ? point[1] - node.maxY : 0;
  return dx * dx + dy * dy;
}

interface NearestEndpoint {
  strokeIndex: number;
  reverse: boolean;
  distanceSquared: number;
}

function findNearestEndpoint(
  node: EndpointNode | null, cursor: Point, used: Uint8Array, best: NearestEndpoint
): void {
  if (!node || distanceToBounds(cursor, node) > best.distanceSquared) return;
  // Equal-position endpoints share a bucket. Advance its cursor only past
  // already-selected strokes, so dense coincident junctions are not rescanned.
  while (node.cursor < node.entries.length && used[node.entries[node.cursor].strokeIndex]) node.cursor++;
  const endpoint = node.entries[node.cursor];
  if (endpoint) {
    const dx = cursor[0] - node.x, dy = cursor[1] - node.y;
    const squared = dx * dx + dy * dy;
    if (squared < best.distanceSquared ||
      (squared === best.distanceSquared &&
        (endpoint.strokeIndex < best.strokeIndex ||
          (endpoint.strokeIndex === best.strokeIndex && !endpoint.reverse && best.reverse)))) {
      best.strokeIndex = endpoint.strokeIndex;
      best.reverse = endpoint.reverse;
      best.distanceSquared = squared;
    }
  }
  let first = node.left, second = node.right;
  if (first && second && distanceToBounds(cursor, second) < distanceToBounds(cursor, first)) {
    first = node.right; second = node.left;
  }
  findNearestEndpoint(first, cursor, used, best);
  findNearestEndpoint(second, cursor, used, best);
}

export function routeElementStrokes(strokes: readonly StrokePath[], direction: Direction): StrokePath[] {
  if (strokes.length <= 1) {
    if (!strokes.length) return [];
    const only = strokes[0];
    const a = only.points[0], b = only.points[only.points.length - 1];
    const reverse = direction === "rtl" ? b[0] > a[0] : b[0] < a[0];
    return [reverse ? { ...only, points: only.points.slice().reverse() } : { ...only, points: only.points.slice() }];
  }

  const rtl = direction === "rtl";
  // Preserve the established first-stroke reading-direction heuristic.
  let firstIndex = -1, firstReverse = false, firstScore = Infinity;
  for (let index = 0; index < strokes.length; index++) for (const reverse of [false, true]) {
    const point = startEndpoint(strokes[index], reverse);
    const score = (rtl ? -point[0] : point[0]) * 10000 + point[1] * 0.01 + index * 1e-7;
    if (score < firstScore) { firstScore = score; firstIndex = index; firstReverse = reverse; }
  }

  // The previous nearest-endpoint scan compared every remaining stroke after
  // every selection (O(n²)). A balanced spatial index keeps large drawings
  // responsive while preserving the same greedy nearest-endpoint route.
  const endpointMap = new Map<string, EndpointBucket>();
  for (let index = 0; index < strokes.length; index++) {
    const points = strokes[index].points;
    const first = points[0], last = points[points.length - 1];
    for (const endpoint of [
      { x: first[0], y: first[1], strokeIndex: index, reverse: false },
      { x: last[0], y: last[1], strokeIndex: index, reverse: true }
    ]) {
      const key = endpoint.x + "," + endpoint.y;
      let bucket = endpointMap.get(key);
      if (!bucket) {
        bucket = { x: endpoint.x, y: endpoint.y, entries: [], cursor: 0 };
        endpointMap.set(key, bucket);
      }
      bucket.entries.push(endpoint);
    }
  }
  for (const bucket of endpointMap.values()) {
    bucket.entries.sort((a, b) => a.strokeIndex - b.strokeIndex || Number(a.reverse) - Number(b.reverse));
  }
  const endpointTree = buildEndpointTree([...endpointMap.values()]);
  const used = new Uint8Array(strokes.length);
  used[firstIndex] = 1;
  const ordered: StrokePath[] = [];
  const first = strokes[firstIndex];
  ordered.push(firstReverse ? { ...first, points: first.points.slice().reverse() } : { ...first, points: first.points.slice() });
  let remaining = strokes.length - 1;
  let cursor = ordered[0].points[ordered[0].points.length - 1];

  while (remaining > 0) {
    const nearest: NearestEndpoint = { strokeIndex: -1, reverse: false, distanceSquared: Infinity };
    findNearestEndpoint(endpointTree, cursor, used, nearest);
    if (nearest.strokeIndex < 0) throw new Error("Unable to route remaining stroke endpoints.");
    const next = strokes[nearest.strokeIndex];
    const routed = nearest.reverse
      ? { ...next, points: next.points.slice().reverse() }
      : { ...next, points: next.points.slice() };
    ordered.push(routed);
    used[nearest.strokeIndex] = 1;
    remaining--;
    cursor = routed.points[routed.points.length - 1];
  }
  return ordered;
}

function makeRows<T extends { bounds: Rect }>(items: T[]): T[][] {
  const sorted = items.slice().sort((a, b) => a.bounds.cy - b.bounds.cy);
  const rows: Array<{ cy: number; height: number; items: T[] }> = [];
  for (const item of sorted) {
    const threshold = Math.max(7, Math.min(30, Math.max(10, item.bounds.height) * 0.48));
    let row: { cy: number; height: number; items: T[] } | undefined;
    // Rows are created in sorted Y order. Search backwards and stop once the
    // current item is below every remaining row's maximum matching distance.
    for (let index = rows.length - 1; index >= 0; index--) {
      const candidate = rows[index];
      const allowed = Math.max(threshold, candidate.height * 0.42);
      const delta = item.bounds.cy - candidate.cy;
      if (delta > allowed) break;
      if (delta >= 0) { row = candidate; break; }
    }
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
