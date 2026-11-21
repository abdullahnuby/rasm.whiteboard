import { boundsOfPoints, distance, interpolate, pathLength } from "./geometry.js";
import type { ComponentRecord, ElementRecord, Point, StrokePath } from "./types.js";

export interface PathAssignment {
  byElement: Map<number, StrokePath[]>;
  coveredComponents: Set<number>;
  orphanPaths: StrokePath[];
  assignedPaths: number;
  splitPaths: number;
}

function nearestLabel(labels: Uint32Array, width: number, height: number, x: number, y: number, radius = 4): number {
  const ix = Math.max(0, Math.min(width - 1, Math.round(x))), iy = Math.max(0, Math.min(height - 1, Math.round(y)));
  const direct = labels[iy * width + ix];
  if (direct) return direct;
  for (let r = 1; r <= radius; r++) {
    let best = 0, bestDistance = Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = ix + dx, ny = iy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const label = labels[ny * width + nx];
      if (!label) continue;
      const squared = dx * dx + dy * dy;
      if (squared < bestDistance) { best = label; bestDistance = squared; }
    }
    if (best) return best;
  }
  return 0;
}

interface OwnedSample { point: Point; componentId: number; elementId: number; }

function sampleOwnedPath(
  stroke: StrokePath, strokeId: string, labels: Uint32Array, width: number, height: number,
  componentToElement: Map<number, number>
): OwnedSample[] {
  const points = stroke.points;
  if (points.length < 2) return [];
  const samples: OwnedSample[] = [];
  for (let segment = 1; segment < points.length; segment++) {
    const a = points[segment - 1], b = points[segment];
    const steps = Math.max(1, Math.ceil(distance(a, b) / 2));
    for (let step = 0; step < steps; step++) {
      const point = interpolate(a, b, step / steps);
      const componentId = nearestLabel(labels, width, height, point[0], point[1]);
      samples.push({ point, componentId, elementId: componentToElement.get(componentId) ?? 0 });
    }
  }
  const last = points[points.length - 1], componentId = nearestLabel(labels, width, height, last[0], last[1]);
  samples.push({ point: last, componentId, elementId: componentToElement.get(componentId) ?? 0 });
  void strokeId;
  return samples;
}

export function assignPathsToElements(
  paths: readonly StrokePath[],
  labels: Uint32Array,
  width: number,
  height: number,
  elements: readonly ElementRecord[],
  components: readonly ComponentRecord[],
  source: "centerline" | "contour"
): PathAssignment {
  const componentToElement = new Map<number, number>();
  for (const element of elements) for (const componentId of element.componentIds) componentToElement.set(componentId, element.id);
  const byElement = new Map<number, StrokePath[]>(elements.map(element => [element.id, []]));
  const coveredComponents = new Set<number>(), orphanPaths: StrokePath[] = [];
  let assignedPaths = 0, splitPaths = 0;
  for (const [pathIndex, path] of paths.entries()) {
    const pathId = path.id || source + "-" + pathIndex;
    const samples = sampleOwnedPath(path, pathId, labels, width, height, componentToElement);
    const runs: Array<{ elementId: number; componentId: number; points: Point[] }> = [];
    let current: { elementId: number; componentId: number; points: Point[] } | null = null;
    for (const sample of samples) {
      if (!sample.elementId) {
        if (current && current.points.length) { runs.push(current); current = null; }
        continue;
      }
      if (!current || current.elementId !== sample.elementId || current.componentId !== sample.componentId) {
        if (current && current.points.length) runs.push(current);
        current = { elementId: sample.elementId, componentId: sample.componentId, points: [sample.point] };
      } else if (distance(current.points[current.points.length - 1], sample.point) > 0.05) current.points.push(sample.point);
    }
    if (current && current.points.length) runs.push(current);
    const useful = runs.filter(run => run.points.length >= 2 && pathLength(run.points) >= 1.1);
    if (!useful.length) {
      orphanPaths.push({ ...path, id: pathId, source });
      continue;
    }
    if (useful.length > 1) splitPaths++;
    for (let runIndex = 0; runIndex < useful.length; runIndex++) {
      const run = useful[runIndex], elementPaths = byElement.get(run.elementId)!;
      elementPaths.push({
        ...path, id: pathId + (useful.length > 1 ? ":" + runIndex : ""),
        points: run.points, source, componentId: run.componentId, elementId: run.elementId
      });
      coveredComponents.add(run.componentId); assignedPaths++;
    }
  }
  void components;
  return { byElement, coveredComponents, orphanPaths, assignedPaths, splitPaths };
}
