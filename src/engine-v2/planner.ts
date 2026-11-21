import { boundsOfPoints, distance, pathLength } from "./geometry.js";
import { assignPathsToElements } from "./path-ownership.js";
import { traceComponentOutline } from "./outline-tracer.js";
import { finalizeElements } from "./route-planner.js";
import type { Direction, DrawingPlan, ElementRecord, RasterAnalysis, SceneOptions, StrokePath } from "./types.js";

function nearestComponentPixel(
  labels: Uint32Array, width: number, height: number, x: number, y: number, componentId: number
): number {
  const ix = Math.max(0, Math.min(width - 1, Math.round(x)));
  const iy = Math.max(0, Math.min(height - 1, Math.round(y)));
  const direct = iy * width + ix;
  if (labels[direct] === componentId) return direct;
  for (let radius = 1; radius <= 4; radius++) {
    let best = -1, bestDistance = Infinity;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const nx = ix + dx, ny = iy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const pixel = ny * width + nx;
      if (labels[pixel] !== componentId) continue;
      const squared = dx * dx + dy * dy;
      if (squared < bestDistance) { best = pixel; bestDistance = squared; }
    }
    if (best >= 0) return best;
  }
  return -1;
}

function measureCenterlineCoverage(
  labels: Uint32Array, width: number, height: number,
  component: RasterAnalysis["components"][number], strokes: readonly StrokePath[]
): number {
  const totalLength = strokes.reduce((sum, stroke) => sum + pathLength(stroke.points), 0);
  if (!(totalLength > 0) || component.area <= 0) return 0;
  const radius = Math.max(2, Math.min(8, component.area / (2 * totalLength)));
  const left = Math.max(0, Math.floor(component.bounds.x));
  const top = Math.max(0, Math.floor(component.bounds.y));
  const right = Math.min(width - 1, Math.ceil(component.bounds.x + component.bounds.width - 1));
  const bottom = Math.min(height - 1, Math.ceil(component.bounds.y + component.bounds.height - 1));
  const localWidth = right - left + 1, localHeight = bottom - top + 1;
  if (localWidth <= 0 || localHeight <= 0) return 0;

  const distances = new Uint8Array(localWidth * localHeight);
  distances.fill(255);
  const queue = new Int32Array(localWidth * localHeight);
  let head = 0, tail = 0;
  const addSeed = (x: number, y: number) => {
    const pixel = nearestComponentPixel(labels, width, height, x, y, component.id);
    if (pixel < 0) return;
    const px = pixel % width, py = (pixel / width) | 0;
    if (px < left || px > right || py < top || py > bottom) return;
    const local = (py - top) * localWidth + px - left;
    if (distances[local] !== 255) return;
    distances[local] = 0;
    queue[tail++] = local;
  };
  for (const stroke of strokes) {
    const points = stroke.points;
    if (points.length < 2) continue;
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1], b = points[index];
      const steps = Math.max(1, Math.ceil(distance(a, b) / 1.5));
      for (let step = 0; step < steps; step++) {
        const fraction = step / steps;
        addSeed(a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction);
      }
    }
    const last = points[points.length - 1];
    addSeed(last[0], last[1]);
  }
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];
  while (head < tail) {
    const local = queue[head++], currentDistance = distances[local];
    if (currentDistance >= radius) continue;
    const x = local % localWidth, y = (local / localWidth) | 0;
    for (let direction = 0; direction < 8; direction++) {
      const nx = x + dx[direction], ny = y + dy[direction];
      if (nx < 0 || nx >= localWidth || ny < 0 || ny >= localHeight) continue;
      const global = (top + ny) * width + left + nx;
      if (labels[global] !== component.id) continue;
      const next = ny * localWidth + nx;
      if (distances[next] !== 255) continue;
      distances[next] = currentDistance + 1;
      queue[tail++] = next;
    }
  }
  return Math.min(1, tail / component.area);
}

function emptyStrokes(elements: readonly RasterAnalysis["elements"][number][]): ElementRecord[] {
  return elements.map(element => ({
    ...element, strokes: [],
    diagnostics: { source: "segmented", tracedComponentIds: [], warnings: [] }
  }));
}

function attachOrphanPaths(elements: ElementRecord[], paths: readonly StrokePath[], firstId: number): number {
  let nextId = firstId, count = 0;
  for (const path of paths) {
    if (path.points.length < 2) continue;
    elements.push({
      id: nextId, componentIds: [], area: 0, bounds: boundsOfPoints(path.points), orderIndex: nextId,
      strokes: [{ ...path, id: path.id || "orphan-" + nextId, source: "orphan", elementId: nextId }],
      diagnostics: {
        source: "orphan-path", tracedComponentIds: [],
        warnings: ["Vector path did not overlap a segmented component; retained as an independent path element."]
      }
    });
    nextId++; count++;
  }
  return count;
}

export function buildDrawingPlan(
  analysis: RasterAnalysis,
  centerPaths: readonly StrokePath[],
  contourPaths: readonly StrokePath[],
  options: SceneOptions = {}
): DrawingPlan {
  const direction: Direction = options.direction ?? "rtl";
  const motionStyle = options.motionStyle ?? "smart";
  const elements: ElementRecord[] = emptyStrokes(analysis.elements);
  const source = motionStyle === "contour" ? contourPaths : centerPaths.length ? centerPaths : contourPaths;
  const primarySource = motionStyle === "contour" ? "contour" : centerPaths.length ? "centerline" : "contour";
  const primary = assignPathsToElements(source, analysis.rasterLabels, analysis.width, analysis.height, elements, analysis.components, primarySource);
  for (const element of elements) element.strokes.push(...(primary.byElement.get(element.id) ?? []));
  let assigned = primary.assignedPaths, split = primary.splitPaths;
  const covered = new Set(primary.coveredComponents);

  if (motionStyle !== "contour" && centerPaths.length && contourPaths.length) {
    const contour = assignPathsToElements(contourPaths, analysis.rasterLabels, analysis.width, analysis.height, elements, analysis.components, "contour");
    let supplementedPaths = 0;
    for (const element of elements) {
      const contourByComponent = new Map<number, StrokePath[]>();
      for (const stroke of contour.byElement.get(element.id) ?? []) {
        if (!Number.isInteger(stroke.componentId)) continue;
        const list = contourByComponent.get(stroke.componentId!) ?? [];
        list.push(stroke);
        contourByComponent.set(stroke.componentId!, list);
      }
      for (const componentId of element.componentIds) {
        const fallback = contourByComponent.get(componentId) ?? [];
        if (!fallback.length) continue;
        const centerStrokes = element.strokes.filter(stroke =>
          stroke.componentId === componentId && stroke.source === "centerline"
        );
        const component = analysis.components.find(item => item.id === componentId);
        const coverage = component && centerStrokes.length
          ? measureCenterlineCoverage(analysis.rasterLabels, analysis.width, analysis.height, component, centerStrokes)
          : 0;
        // A component may contain several branches. One centreline is not
        // sufficient evidence that the entire connected raster shape is covered.
        if (!centerStrokes.length || coverage < 0.82) {
          element.strokes.push(...fallback);
          supplementedPaths += fallback.length;
          covered.add(componentId);
          if (centerStrokes.length) element.diagnostics.warnings.push(
            "Contour paths supplemented component " + componentId +
            " because centreline coverage was only " + Math.round(coverage * 100) + "%."
          );
        }
      }
    }
    assigned += supplementedPaths;
    split += contour.splitPaths;
  }

  let tracedComponents = 0;
  for (const element of elements) for (const componentId of element.componentIds) {
    if (covered.has(componentId) || element.strokes.some(stroke => stroke.componentId === componentId)) continue;
    const component = analysis.components.find(item => item.id === componentId);
    if (!component) continue;
    const traced = traceComponentOutline(
      analysis.rasterLabels, analysis.width, analysis.height, componentId,
      component.bounds, options.simplifyTolerance ?? 0.45
    );
    if (traced) {
      traced.elementId = element.id;
      element.strokes.push(traced);
      element.diagnostics.tracedComponentIds.push(componentId);
      covered.add(componentId);
      tracedComponents++;
    } else element.diagnostics.warnings.push("Could not trace a route for component " + componentId + ".");
  }

  const maxId = elements.reduce((max, element) => Math.max(max, element.id), 0);
  const orphanCount = attachOrphanPaths(elements, primary.orphanPaths, maxId + 1);
  const componentOwners = new Set(elements.flatMap(element => element.componentIds));
  const labelsWithoutElements = analysis.components.filter(component => !componentOwners.has(component.id)).length;
  const componentRouteSet = new Set(elements.flatMap(element =>
    element.strokes.map(stroke => stroke.componentId).filter((id): id is number => Number.isInteger(id))
  ));
  const componentsWithoutStrokes = analysis.components.filter(component => !componentRouteSet.has(component.id)).length;
  const warnings = analysis.diagnostics.warnings.slice();
  if (orphanCount) warnings.push(orphanCount + " vector paths were kept as independent elements.");
  if (componentsWithoutStrokes) warnings.push(componentsWithoutStrokes + " raster components still have no pen path.");
  const diagnostics = {
    ...analysis.diagnostics,
    phase: "planning",
    elementCount: elements.length,
    inputCenterlinePaths: centerPaths.length,
    inputContourPaths: contourPaths.length,
    assignedPaths: assigned,
    splitPaths: split,
    tracedComponents,
    orphanPaths: orphanCount,
    labelsWithoutElements,
    componentsWithoutStrokes,
    warnings
  };
  const finalized = finalizeElements(elements, direction, options.zones ?? []);
  const plans = finalized.elements.map(plan => {
    const element = elements.find(item => item.id === plan.id);
    if (element) plan.diagnostics = element.diagnostics;
    return plan;
  });
  return {
    schemaVersion: 2, width: analysis.width, height: analysis.height,
    rasterLabels: analysis.rasterLabels, components: analysis.components,
    elements: plans, lines: finalized.lines, length: finalized.length,
    totalDistance: finalized.totalDistance, direction, diagnostics
  };
}
