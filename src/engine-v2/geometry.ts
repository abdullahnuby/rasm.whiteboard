import type { Point, Rect, StrokePath } from "./types.js";

export function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function boundsOfPoints(points: readonly Point[]): Rect {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0, cx: 0, cy: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export function unionBounds(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y, cx: (x + right) / 2, cy: (y + bottom) / 2 };
}

export function pathLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i]);
  return length;
}

export function interpolate(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function resamplePath(points: readonly Point[], spacing = 2): Point[] {
  if (points.length < 2) return points.slice();
  const result: Point[] = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], segment = distance(a, b);
    if (segment <= 1e-6) continue;
    let next = spacing - carry;
    while (next < segment) {
      result.push(interpolate(a, b, next / segment));
      next += spacing;
    }
    carry = (carry + segment) % spacing;
  }
  const last = points[points.length - 1], tail = result[result.length - 1];
  if (distance(last, tail) > 1e-4) result.push(last);
  return result;
}

export function simplifyPath(points: readonly Point[], tolerance = 0.55): Point[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1; keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]], limit = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const a = points[first], b = points[last];
    const dx = b[0] - a[0], dy = b[1] - a[1], denominator = dx * dx + dy * dy;
    let farthest = limit, index = -1;
    for (let i = first + 1; i < last; i++) {
      const p = points[i];
      let t = denominator ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denominator : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = p[0] - (a[0] + t * dx), ey = p[1] - (a[1] + t * dy);
      const squared = ex * ex + ey * ey;
      if (squared > farthest) { farthest = squared; index = i; }
    }
    if (index >= 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

export function simplifyWithPaper(points: readonly Point[], tolerance = 0.55): Point[] {
  const paper = (globalThis as typeof globalThis & { paper?: any }).paper;
  try {
    if (paper?.PaperScope) {
      const scope = new paper.PaperScope();
      const path = new scope.Path();
      for (const [x, y] of points) path.add(new scope.Point(x, y));
      path.simplify(Math.max(0.05, tolerance));
      const output = path.segments.map((segment: any) => [segment.point.x, segment.point.y] as Point);
      path.remove();
      if (output.length >= 2) return output;
    }
  } catch {
    // Paper.js is an optional accelerator; the deterministic simplifier is authoritative.
  }
  return simplifyPath(points, tolerance);
}

export function cloneStroke(stroke: StrokePath, points = stroke.points): StrokePath {
  return { ...stroke, points: points.slice() };
}
