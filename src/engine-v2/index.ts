import { analyzeRaster } from "./segmentation.js";
import { buildDrawingPlan } from "./planner.js";
import { buildRevealSchedule } from "./reveal-scheduler.js";
import { applyToLegacyScene, buildLegacyRevealSchedule, buildLegacyRevealInput } from "./legacy-adapter.js";

export const ENGINE_VERSION = "2.0.0" as const;
export { analyzeRaster, buildDrawingPlan, buildRevealSchedule };
export { buildLegacyRevealInput, buildLegacyRevealSchedule, applyToLegacyScene };
export { createEngineReport } from "./diagnostics.js";
export { traceComponentOutline } from "./outline-tracer.js";
export { assignPathsToElements } from "./path-ownership.js";
export { labelConnectedComponents, buildForegroundMask, groupComponents } from "./segmentation.js";
export { routeElementStrokes, orderElements, finalizeElements } from "./route-planner.js";
export { analyzeAndPlan } from "./pipeline.js";
export { createRevealWorkerRequest, workerTransferables } from "./worker-contract.js";
export type * from "./types.js";
