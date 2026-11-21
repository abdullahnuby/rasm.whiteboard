import { analyzeRaster } from "./segmentation.js";
import { buildDrawingPlan } from "./planner.js";
import { buildRevealSchedule } from "./reveal-scheduler.js";
import type { RasterFrame, RevealPlan, SceneOptions, StrokePath, RasterAnalysis, DrawingPlan } from "./types.js";

export interface PipelineResult { analysis: RasterAnalysis; plan: DrawingPlan; reveal: RevealPlan; }

export function analyzeAndPlan(
  frame: RasterFrame, centerPaths: readonly StrokePath[], contourPaths: readonly StrokePath[],
  options: SceneOptions = {}
): PipelineResult {
  const analysis = analyzeRaster(frame.pixels, frame.width, frame.height);
  const plan = buildDrawingPlan(analysis, centerPaths, contourPaths, options);
  const reveal = buildRevealSchedule({
    width: plan.width, height: plan.height, rasterLabels: plan.rasterLabels,
    lines: plan.lines, totalDistance: plan.totalDistance,
    shapeGroups: plan.elements.map(element => ({ id: element.id, rasterComponentLabels: element.componentIds }))
  });
  return { analysis, plan, reveal };
}
