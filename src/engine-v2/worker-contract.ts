import type { RevealSceneInput } from "./types.js";

export interface RevealWorkerRequest extends RevealSceneInput { id: number; }
export interface RevealWorkerSuccess { id: number; plan: { order: Uint32Array; ends: Uint32Array; totalPixels: number; totalDistance: number; diagnostics: unknown }; }
export interface RevealWorkerFailure { id: number; error: string; }
export type RevealWorkerResponse = RevealWorkerSuccess | RevealWorkerFailure;

export function createRevealWorkerRequest(id: number, scene: RevealSceneInput): RevealWorkerRequest {
  if (!Number.isInteger(id) || id < 1) throw new TypeError("Worker request ID must be a positive integer.");
  if (scene.rasterLabels.length !== scene.width * scene.height) throw new TypeError("Worker payload raster dimensions do not match.");
  if (!scene.shapeGroups.length) throw new TypeError("Worker payload must contain at least one drawable element.");
  return {
    id, width: scene.width, height: scene.height, totalDistance: scene.totalDistance,
    rasterLabels: scene.rasterLabels.slice(),
    lines: scene.lines.map(line => ({
      ...line, points: line.points.map(point => [point[0], point[1]] as const)
    })),
    shapeGroups: scene.shapeGroups.map(group => ({
      id: group.id, rasterComponentLabels: group.rasterComponentLabels.slice()
    }))
  };
}

export function workerTransferables(request: RevealWorkerRequest): Transferable[] {
  return [request.rasterLabels.buffer as ArrayBuffer];
}
