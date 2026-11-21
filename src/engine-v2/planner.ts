import { boundsOfPoints } from "./geometry.js";
import { assignPathsToElements } from "./path-ownership.js";
import { traceComponentOutline } from "./outline-tracer.js";
import { finalizeElements } from "./route-planner.js";
import type { Direction, DrawingPlan, ElementRecord, RasterAnalysis, SceneOptions, StrokePath } from "./types.js";

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
    for (const element of elements) {
      const known = new Set(element.strokes.map(stroke => stroke.componentId).filter((id): id is number => Number.isInteger(id)));
      const fallback = (contour.byElement.get(element.id) ?? []).filter(stroke => !known.has(stroke.componentId ?? -1));
      element.strokes.push(...fallback);
      for (const stroke of fallback) if (stroke.componentId) covered.add(stroke.componentId);
    }
    assigned += contour.assignedPaths; split += contour.splitPaths;
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
