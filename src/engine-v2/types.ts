export type Direction = "rtl" | "ltr";
export type StrokeSource = "centerline" | "contour" | "raster-outline" | "orphan";
export type Point = readonly [number, number];

export interface Rect { x: number; y: number; width: number; height: number; cx: number; cy: number; }
export interface RasterFrame { width: number; height: number; pixels: Uint8ClampedArray; }
export interface ComponentRecord { id: number; area: number; bounds: Rect; }
export interface RasterElement { id: number; componentIds: number[]; area: number; bounds: Rect; orderIndex: number; manualZone?: number; durationWeight?: number; }
export interface ElementRecord {
  id: number; componentIds: number[]; area: number; bounds: Rect; orderIndex: number; manualZone?: number; durationWeight?: number;
  strokes: StrokePath[];
  diagnostics: { source: "segmented" | "orphan-path"; tracedComponentIds: number[]; warnings: string[] };
}
export interface StrokePath {
  id?: string; points: Point[]; source?: StrokeSource; color?: string;
  componentId?: number; elementId?: number; start?: number; shapeId?: number; synthetic?: boolean; cumulative?: Float32Array;
}
export interface RasterAnalysis {
  schemaVersion: 2; width: number; height: number; rasterLabels: Uint32Array;
  authorOrder?: boolean;
  unassignedElementId?: number;
  components: ComponentRecord[]; elements: RasterElement[];
  background: [number, number, number]; foregroundDensity: number;
  backend: "connected-components-8" | "opencv-connected-components-8";
  diagnostics: EngineDiagnostics;
}
export interface SceneOptions {
  direction?: Direction; motionStyle?: "smart" | "contour" | "centerline";
  zones?: Array<{ x: number; y: number; w: number; h: number }>;
  simplifyTolerance?: number;
}
export interface ElementPlan {
  id: number; componentIds: number[]; bounds: Rect; area: number; orderIndex: number; manualZone?: number; durationWeight?: number;
  strokes: StrokePath[]; diagnostics: ElementRecord["diagnostics"];
  startDistance: number; endDistance: number;
}
export interface DrawingPlan {
  schemaVersion: 2; width: number; height: number; rasterLabels: Uint32Array;
  components: ComponentRecord[]; elements: ElementPlan[]; lines: StrokePath[];
  length: number; totalDistance: number; direction: Direction; diagnostics: EngineDiagnostics;
}
export interface TravelSegment {
  line: StrokePath; elementId: number; begin: number; draw: number; end: number;
  cumulative: Float64Array; previous: Point | null;
}
export interface RevealSceneInput {
  width: number; height: number; totalDistance: number; rasterLabels: Uint32Array;
  lines: StrokePath[];
  resolution?:256|65536;
  revealSpread?:'legacy'|'near-pen';
  shapeGroups: Array<{ id: number; rasterComponentLabels: number[] }>;
}
export interface RevealPlan {
  order: Uint32Array; ends: Uint32Array; timings: Uint8Array|Uint16Array; totalPixels: number;
  totalDistance: number; elementWindows: Array<{ elementId: number; start: number; end: number }>;
  diagnostics: { scheduledPixels: number; backgroundPixels: number; unscheduledPixels: number; unseededComponents: number[] };
}
export interface EngineDiagnostics {
  engineVersion: "2.0.0"; phase: string; width: number; height: number; pixelCount: number;
  foregroundPixels: number; backgroundPixels: number; foregroundDensity: number;
  componentCount: number; elementCount: number; inputCenterlinePaths: number; inputContourPaths: number;
  assignedPaths: number; splitPaths: number; tracedComponents: number; orphanPaths: number;
  labelsWithoutElements: number; componentsWithoutStrokes: number; rasterPixelsWithoutSeed: number;
  warnings: string[]; durationsMs: Record<string, number>;
}
export interface LegacyScene {
  src: HTMLCanvasElement; baseLines: StrokePath[]; centerBaseLines?: StrokePath[];
  zones?: Array<{ x: number; y: number; w: number; h: number }>;
  motionStyle?: "smart" | "contour" | "centerline"; elementDirection?: Direction;
  shapeSequence?: "smart" | "strokes"; engineAnalysisV2?: RasterAnalysis; enginePlanV2?: DrawingPlan;
  engineDiagnostics?: EngineDiagnostics; rasterLabels?: Uint32Array;
  shapeGroups?: Array<{ id: number; rasterComponentLabels: number[]; pathCount: number; bounds: Rect; startDistance?: number; endDistance?: number }>;
  lines: StrokePath[]; length: number; totalDistance?: number; [key: string]: unknown;
}
