import { simplifyWithPaper } from "./geometry.js";
import type { Point, Rect, StrokePath } from "./types.js";

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]
];

function hasNeighbourOutside(labels: Uint32Array, width: number, height: number, x: number, y: number, componentId: number): boolean {
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height || labels[ny * width + nx] !== componentId) return true;
  }
  return false;
}

export function traceComponentOutline(
  labels: Uint32Array, width: number, height: number, componentId: number,
  bounds: Rect, tolerance = 0.45
): StrokePath | null {
  let startX = -1, startY = -1;
  const left = Math.max(0, Math.floor(bounds.x) - 1), right = Math.min(width - 1, Math.ceil(bounds.x + bounds.width));
  const top = Math.max(0, Math.floor(bounds.y) - 1), bottom = Math.min(height - 1, Math.ceil(bounds.y + bounds.height));
  for (let y = top; y <= bottom && startY < 0; y++) for (let x = left; x <= right; x++) {
    if (labels[y * width + x] === componentId && hasNeighbourOutside(labels, width, height, x, y, componentId)) {
      startX = x; startY = y; break;
    }
  }
  if (startX < 0) return null;
  const start: Point = [startX, startY], points: Point[] = [start];
  let currentX = startX, currentY = startY, backDirection = 0;
  let firstNext = -1;
  const maxIterations = Math.min(width * height * 2, Math.max(24, Math.ceil((bounds.width + bounds.height) * 12)));
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let found = -1, nextX = currentX, nextY = currentY;
    for (let step = 1; step <= 8; step++) {
      const direction = (backDirection + step) & 7;
      const [dx, dy] = NEIGHBOURS[direction], x = currentX + dx, y = currentY + dy;
      if (x < left || x > right || y < top || y > bottom) continue;
      if (labels[y * width + x] === componentId) { found = direction; nextX = x; nextY = y; break; }
    }
    if (found < 0) break;
    const nextPixel = nextY * width + nextX;
    if (firstNext < 0) firstNext = nextPixel;
    else if (currentX === startX && currentY === startY && nextPixel === firstNext) break;
    points.push([nextX, nextY]);
    currentX = nextX; currentY = nextY;
    backDirection = (found + 7) & 7;
    if (currentX === startX && currentY === startY) break;
  }
  const simplified = simplifyWithPaper(points, tolerance);
  if (simplified.length < 2) {
    // Single-pixel marks still receive a real local pen stroke, not a canvas-wide fallback.
    const cx = startX + 0.5, cy = startY + 0.5;
    return { id: "raster-component-" + componentId, points: [[cx - 0.3, cy], [cx + 0.3, cy]], source: "raster-outline", componentId };
  }
  return { id: "raster-component-" + componentId, points: simplified, source: "raster-outline", componentId };
}
