import type { DrawingPlan, EngineDiagnostics, RasterAnalysis, RevealPlan } from "./types.js";

export interface EngineReport {
  reportVersion: 1;
  engineVersion: "2.0.0";
  createdAt: string;
  analysis: EngineDiagnostics;
  plan: EngineDiagnostics;
  schedule?: RevealPlan["diagnostics"];
  elements: Array<{
    id: number; orderIndex: number; componentIds: number[]; bounds: unknown;
    strokeCount: number; strokeSources: string[]; tracedComponentIds: number[]; warnings: string[];
    startDistance: number; endDistance: number;
  }>;
}

export function createEngineReport(
  analysis: RasterAnalysis,
  plan: DrawingPlan,
  schedule?: RevealPlan
): EngineReport {
  return {
    reportVersion: 1, engineVersion: "2.0.0", createdAt: new Date().toISOString(),
    analysis: { ...analysis.diagnostics, warnings: analysis.diagnostics.warnings.slice(), durationsMs: { ...analysis.diagnostics.durationsMs } },
    plan: { ...plan.diagnostics, warnings: plan.diagnostics.warnings.slice(), durationsMs: { ...plan.diagnostics.durationsMs } },
    ...(schedule ? { schedule: { ...schedule.diagnostics } } : {}),
    elements: plan.elements.map(element => ({
      id: element.id, orderIndex: element.orderIndex, componentIds: element.componentIds.slice(),
      bounds: { ...element.bounds }, strokeCount: element.strokes.length,
      strokeSources: element.strokes.map(stroke => stroke.source),
      tracedComponentIds: element.diagnostics.tracedComponentIds.slice(),
      warnings: element.diagnostics.warnings.slice(),
      startDistance: element.startDistance, endDistance: element.endDistance
    }))
  };
}
