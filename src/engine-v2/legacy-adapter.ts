import { analyzeRaster } from "./segmentation.js";
import { buildDrawingPlan } from "./planner.js";
import { buildRevealSchedule } from "./reveal-scheduler.js";
import type { Direction, DrawingPlan, LegacyScene, RasterAnalysis, RevealPlan, RevealSceneInput, SceneOptions } from "./types.js";

export interface LegacyApplyResult { analysis: RasterAnalysis; plan: DrawingPlan; }

export function buildLegacyRevealInput(scene: {
  src?: { width: number; height: number };
  rasterLabels?: Uint32Array; lines?: DrawingPlan["lines"];
  shapeGroups?: Array<{ id: number; rasterComponentLabels: number[] }>;
  totalDistance?: number;
}): RevealSceneInput {
  const width = scene.src?.width ?? 0, height = scene.src?.height ?? 0;
  if (!width || !height || !(scene.rasterLabels instanceof Uint32Array)) {
    throw new Error("Engine v2: no raster ownership map. Analyse the image before preview or export.");
  }
  return {
    width, height, rasterLabels: scene.rasterLabels, lines: scene.lines ?? [],
    totalDistance: scene.totalDistance ?? 0,
    shapeGroups: (scene.shapeGroups ?? []).map(group => ({
      id: group.id, rasterComponentLabels: group.rasterComponentLabels.slice()
    }))
  };
}

export function applyToLegacyScene(scene: LegacyScene, precomputedAnalysis?: RasterAnalysis): LegacyApplyResult {
  const width = scene.src.width, height = scene.src.height;
  let analysis = precomputedAnalysis ?? scene.engineAnalysisV2;
  if (analysis && (analysis.width !== width || analysis.height !== height ||
      analysis.rasterLabels.length !== width * height)) analysis = undefined;
  if (!analysis) {
    const context = scene.src.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Engine v2 cannot read the image canvas.");
    analysis = analyzeRaster(context.getImageData(0, 0, width, height).data, width, height);
  }
  const options: SceneOptions = {
    direction: scene.elementDirection ?? "rtl",
    motionStyle: scene.motionStyle ?? "smart",
    zones: scene.zones ?? []
  };
  const plan = buildDrawingPlan(analysis, scene.centerBaseLines ?? [], scene.baseLines ?? [], options);
  scene.engineAnalysisV2 = analysis;
  scene.enginePlanV2 = plan;
  scene.engineDiagnostics = plan.diagnostics;
  scene.engineScheduleError = undefined;
  scene.rasterLabels = plan.rasterLabels;
  scene.lines = plan.lines;
  scene.length = plan.length;
  scene.totalDistance = plan.totalDistance;
  scene.shapeGroups = plan.elements.map(element => ({
    id: element.id,
    rasterComponentLabels: element.componentIds.slice(),
    pathCount: element.strokes.length,
    bounds: { ...element.bounds },
    startDistance: element.startDistance,
    endDistance: element.endDistance
  }));
  scene.usingCenterline = options.motionStyle !== "contour" && plan.lines.some(line => line.source === "centerline");
  return { analysis, plan };
}

export function buildLegacyRevealSchedule(scene: Parameters<typeof buildLegacyRevealInput>[0]): RevealPlan {
  return buildRevealSchedule(buildLegacyRevealInput(scene));
}

export function optionsFromLegacyScene(scene: LegacyScene): SceneOptions {
  return {
    direction: (scene.elementDirection ?? "rtl") as Direction,
    motionStyle: scene.motionStyle ?? "smart",
    zones: scene.zones ?? []
  };
}
