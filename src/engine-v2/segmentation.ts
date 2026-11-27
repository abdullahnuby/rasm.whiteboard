import type { ComponentRecord, RasterAnalysis, Rect } from "./types.js";

export interface SegmentationOptions { colorThreshold?: number; minComponentArea?: number; }

interface ForegroundResult {
  mask: Uint8Array;
  background: [number, number, number];
  density: number;
}
interface LabelResult {
  labels: Uint32Array;
  components: ComponentRecord[];
  backend: RasterAnalysis["backend"];
}

function median(values: number[]): number {
  if (!values.length) return 255;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

function sampleBackground(pixels: Uint8ClampedArray, width: number, height: number): [number, number, number] {
  const samples: [number[], number[], number[]] = [[], [], []];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 180));
  const add = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    if (pixels[offset + 3] < 16) return;
    for (let channel = 0; channel < 3; channel++) samples[channel].push(pixels[offset + channel]);
  };
  for (let x = 0; x < width; x += step) { add(x, 0); add(x, height - 1); }
  for (let y = step; y < height - 1; y += step) { add(0, y); add(width - 1, y); }
  return [median(samples[0]), median(samples[1]), median(samples[2])];
}

export function buildForegroundMask(
  pixels: Uint8ClampedArray, width: number, height: number, options: SegmentationOptions = {}
): ForegroundResult {
  if (pixels.length !== width * height * 4) throw new TypeError("RGBA buffer size does not match raster dimensions.");
  const background = sampleBackground(pixels, width, height);
  const threshold = options.colorThreshold ?? 26;
  const mask = new Uint8Array(width * height);
  let count = 0;
  for (let p = 0, q = 0; p < mask.length; p++, q += 4) {
    if (pixels[q + 3] < 16) continue;
    const dr = pixels[q] - background[0], dg = pixels[q + 1] - background[1], db = pixels[q + 2] - background[2];
    const colourDistance = Math.hypot(dr * 0.92, dg, db * 0.92);
    const channelContrast = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));
    if (colourDistance >= threshold || channelContrast >= threshold * 1.55) { mask[p] = 1; count++; }
  }
  return { mask, background, density: count / Math.max(1, mask.length) };
}

function makeBounds(minX: number, minY: number, maxX: number, maxY: number): Rect {
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function labelWithOpenCv(mask: Uint8Array, width: number, height: number, minArea: number): LabelResult | null {
  const cv = (globalThis as typeof globalThis & { cv?: any }).cv;
  if (!cv?.Mat || !cv?.connectedComponentsWithStats) return null;
  let source: any, labelsMat: any, stats: any, centroids: any;
  try {
    source = new cv.Mat(height, width, cv.CV_8UC1); source.data.set(mask);
    labelsMat = new cv.Mat(); stats = new cv.Mat(); centroids = new cv.Mat();
    const count = cv.connectedComponentsWithStats(source, labelsMat, stats, centroids, 8, cv.CV_32S);
    const labels = new Uint32Array(width * height), components: ComponentRecord[] = [];
    const raw = labelsMat.data32S;
    for (let pixel = 0; pixel < labels.length; pixel++) labels[pixel] = raw[pixel] > 0 ? raw[pixel] : 0;
    for (let id = 1; id < count; id++) {
      const offset = id * 5, area = stats.data32S[offset + cv.CC_STAT_AREA];
      if (area < minArea) {
        for (let pixel = 0; pixel < labels.length; pixel++) if (labels[pixel] === id) labels[pixel] = 0;
        continue;
      }
      const x = stats.data32S[offset + cv.CC_STAT_LEFT], y = stats.data32S[offset + cv.CC_STAT_TOP];
      const w = stats.data32S[offset + cv.CC_STAT_WIDTH], h = stats.data32S[offset + cv.CC_STAT_HEIGHT];
      components.push({ id, area, bounds: { x, y, width: w, height: h, cx: x + w / 2, cy: y + h / 2 } });
    }
    return { labels, components, backend: "opencv-connected-components-8" };
  } catch {
    return null;
  } finally {
    for (const value of [source, labelsMat, stats, centroids]) try { value?.delete?.(); } catch { /* release best-effort */ }
  }
}

export function labelConnectedComponents(mask: Uint8Array, width: number, height: number, minArea = 1): LabelResult {
  const size = width * height;
  if (mask.length !== size) throw new TypeError("Foreground mask size does not match raster dimensions.");
  const accelerated = labelWithOpenCv(mask, width, height, minArea);
  if (accelerated) return accelerated;
  const labels = new Uint32Array(size), queue = new Uint32Array(size), components: ComponentRecord[] = [];
  let nextLabel = 0;
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1], dy = [0, -1, -1, -1, 0, 1, 1, 1];
  for (let seed = 0; seed < size; seed++) {
    if (!mask[seed] || labels[seed]) continue;
    const id = ++nextLabel;
    let head = 0, tail = 0, minX = width, minY = height, maxX = -1, maxY = -1;
    labels[seed] = id; queue[tail++] = seed;
    while (head < tail) {
      const pixel = queue[head++], x = pixel % width, y = (pixel / width) | 0;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (let direction = 0; direction < 8; direction++) {
        const nx = x + dx[direction], ny = y + dy[direction];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighbour = ny * width + nx;
        if (mask[neighbour] && labels[neighbour] === 0) { labels[neighbour] = id; queue[tail++] = neighbour; }
      }
    }
    if (tail >= minArea) components.push({ id, area: tail, bounds: makeBounds(minX, minY, maxX, maxY) });
    else for (let i = 0; i < tail; i++) labels[queue[i]] = 0;
  }
  return { labels, components, backend: "connected-components-8" };
}

function encloses(outer: Rect, inner: Rect): boolean {
  const paddingX = Math.max(1, outer.width * 0.025), paddingY = Math.max(1, outer.height * 0.025);
  return outer.width >= inner.width * 1.35 && outer.height >= inner.height * 1.35 &&
    inner.x >= outer.x + paddingX && inner.y >= outer.y + paddingY &&
    inner.x + inner.width <= outer.x + outer.width - paddingX &&
    inner.y + inner.height <= outer.y + outer.height - paddingY;
}

function attachSmallMark(small: ComponentRecord, large: ComponentRecord): boolean {
  if (small.area > large.area * 0.22 || isStrokeLike(large.bounds)) return false;
  const a = small.bounds, b = large.bounds;
  const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
  const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  const aligned = Math.abs(a.cx - b.cx) <= Math.max(5, b.width * 0.45);
  return a.width <= Math.max(5, b.width * 0.72) && a.height <= Math.max(5, b.height * 0.6) &&
    aligned && gapY <= Math.max(7, b.height * 0.55) && gapX <= Math.max(4, b.width * 0.35);
}

// A component many times longer than it is thick is a line, wire, arrow or
// underline, not a letter: marks must not attach to it. Otherwise a touching
// diacritic pulls the whole stroke into its word's element (and transitively
// every other word the stroke touches), scrambling the reading order again.
function isStrokeLike(bounds: Rect): boolean {
  return bounds.width >= bounds.height * 6 || bounds.height >= bounds.width * 6;
}

// Arabic diacritics (dots above ب ت ث ن ي, the three dots of ش) can be wider
// than attachSmallMark allows: a two/three-dot mark is often nearly as wide as
// its letter and heavier than 22% of its area. A diacritic still hugs its
// letter: it sits directly on it (vertical gap close to zero) and mostly
// inside the letter's horizontal span. That tight footprint is what separates
// a real diacritic from an independent label, so the area and width limits
// can be relaxed here.
function attachDiacritic(small: ComponentRecord, large: ComponentRecord): boolean {
  if (small.area > large.area * 0.8 || isStrokeLike(large.bounds)) return false;
  const a = small.bounds, b = large.bounds;
  const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  return a.width <= Math.max(6, b.width * 1.15) && a.height <= Math.max(6, b.height * 0.9) &&
    gapY <= Math.max(4, a.height * 0.6) && overlapX >= a.width * 0.6;
}

// Marks attach to letters and small shapes, never to a canvas-dominating
// drawing: a large border, wire frame or diagram that spans much of the image
// would otherwise adopt every nearby word (its size-based allowances scale
// with its own size), merging whole text lines into the drawing and scrambling
// their reading order. Content next to a big drawing is drawn as its own
// element in normal reading order instead.
function isCanvasDominating(bounds: Rect, image?: { width: number; height: number }): boolean {
  if (!image) return false;
  const area = image.width * image.height;
  return bounds.width >= image.width * 0.25 && bounds.height >= image.height * 0.12 &&
    bounds.width * bounds.height >= area * 0.05;
}

export function groupComponents(components: ComponentRecord[], image?: { width: number; height: number }): Array<{ id: number; componentIds: number[]; area: number; bounds: Rect }> {
  if (!components.length) return [];
  const parents = components.map((_, index) => index);
  const find = (value: number): number => {
    while (parents[value] !== value) { parents[value] = parents[parents[value]]; value = parents[value]; }
    return value;
  };
  const join = (a: number, b: number) => { const left = find(a), right = find(b); if (left !== right) parents[right] = left; };
  // Spatial indexes are split by component size/area as well as position.
  // Components that cannot be a valid parent/child are not compared, even when
  // thousands of tiny marks occupy the same spatial cell.
  const cellSize = 48;
  type SpatialIndex = Map<number, Map<string, number[]>>;
  const enclosureIndex: SpatialIndex = new Map();
  const attachmentIndex: SpatialIndex = new Map();
  const cellKey = (x: number, y: number) => Math.floor(x / cellSize) + ":" + Math.floor(y / cellSize);
  const insert = (index: SpatialIndex, tier: number, key: string, componentIndex: number) => {
    let cells = index.get(tier);
    if (!cells) { cells = new Map(); index.set(tier, cells); }
    const bucket = cells.get(key) ?? [];
    bucket.push(componentIndex);
    cells.set(key, bucket);
  };
  const tierFor = (value: number) => value >= 1 ? Math.floor(Math.log2(value)) : -1;
  components.forEach((component, index) => {
    const b = component.bounds, key = cellKey(b.cx, b.cy);
    insert(enclosureIndex, tierFor(Math.max(b.width, b.height)), key, index);
    insert(attachmentIndex, tierFor(component.area), key, index);
  });

  const visitCandidates = (
    index: SpatialIndex, maximumMetric: number,
    minX: number, maxX: number, minY: number, maxY: number,
    visit: (candidateIndex: number) => void
  ) => {
    const maximumTier = tierFor(maximumMetric);
    if (maximumTier < 0) return;
    const minCellX = Math.floor(minX / cellSize), maxCellX = Math.floor(maxX / cellSize);
    const minCellY = Math.floor(minY / cellSize), maxCellY = Math.floor(maxY / cellSize);
    for (let tier = 0; tier <= maximumTier; tier++) {
      const cells = index.get(tier);
      if (!cells) continue;
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
          const candidates = cells.get(cellX + ":" + cellY);
          if (candidates) for (const candidateIndex of candidates) visit(candidateIndex);
        }
      }
    }
  };

  for (let i = 0; i < components.length; i++) {
    const parent = components[i], b = parent.bounds;
    // An enclosed component's centre is inside the parent bounds; each of its
    // dimensions must fit within the parent's smaller dimension / 1.35.
    const enclosureLimit = Math.min(b.width, b.height) / 1.35;
    visitCandidates(enclosureIndex, enclosureLimit, b.x, b.x + b.width, b.y, b.y + b.height, j => {
      if (i !== j && encloses(b, components[j].bounds)) join(i, j);
    });

    // Detached marks are indexed by area first, then checked with the exact
    // original alignment and gap rules, plus the relaxed diacritic footprint.
    // Canvas-dominating drawings adopt nothing: their scaled allowances would
    // swallow independent nearby content (see isCanvasDominating).
    const attachAreaLimit = parent.area * 0.8;
    const rangeX = Math.max(6, b.width * 1.15);
    const rangeY = b.height * 0.5 + Math.max(3, b.height * 0.45) + Math.max(7, b.height * 0.55);
    const dominating = isCanvasDominating(b, image);
    visitCandidates(attachmentIndex, attachAreaLimit,
      b.cx - rangeX, b.cx + rangeX, b.cy - rangeY, b.cy + rangeY, j => {
        if (i === j || dominating) return;
        const candidate = components[j];
        if (attachSmallMark(candidate, parent) || attachDiacritic(candidate, parent)) join(i, j);
      }
    );
  }
  const buckets = new Map<number, ComponentRecord[]>();
  components.forEach((component, index) => {
    const root = find(index), list = buckets.get(root) ?? [];
    list.push(component); buckets.set(root, list);
  });
  return [...buckets.values()].map(items => {
    const bounds = items.slice(1).reduce((current, item) => {
      const b = item.bounds, x = Math.min(current.x, b.x), y = Math.min(current.y, b.y);
      const right = Math.max(current.x + current.width, b.x + b.width), bottom = Math.max(current.y + current.height, b.y + b.height);
      return { x, y, width: right - x, height: bottom - y, cx: (x + right) / 2, cy: (y + bottom) / 2 };
    }, { ...items[0].bounds });
    return { id: 0, componentIds: items.map(item => item.id), area: items.reduce((sum, item) => sum + item.area, 0), bounds };
  });
}

function now(): number { return typeof performance !== "undefined" ? performance.now() : Date.now(); }

export function analyzeRaster(
  pixels: Uint8ClampedArray, width: number, height: number, options: SegmentationOptions = {}
): RasterAnalysis {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3) throw new TypeError("Invalid raster dimensions.");
  const started = now();
  const foreground = buildForegroundMask(pixels, width, height, options);
  let { labels, components, backend } = labelConnectedComponents(foreground.mask, width, height, options.minComponentArea ?? 1);
  let effectiveForeground = foreground.density;
  const warnings: string[] = [];
  if (foreground.density > 0.72) {
    // Photographs or textured backgrounds are kept as one explicit canvas element.
    labels = new Uint32Array(width * height); labels.fill(1);
    components = [{ id: 1, area: width * height, bounds: { x: 0, y: 0, width, height, cx: width / 2, cy: height / 2 } }];
    effectiveForeground = 1;
    warnings.push("The source has high foreground density and is treated as one photographic element; semantic segmentation is not assumed.");
  } else if (!components.length) {
    labels = new Uint32Array(width * height); labels.fill(1);
    components = [{ id: 1, area: width * height, bounds: { x: 0, y: 0, width, height, cx: width / 2, cy: height / 2 } }];
    effectiveForeground = 1;
    warnings.push("No distinct foreground was detected; the full canvas is retained as one element for diagnostics.");
  }
  let groups = groupComponents(components, { width, height });
  groups.sort((a, b) => a.bounds.cy - b.bounds.cy || b.bounds.cx - a.bounds.cx);
  groups = groups.map((group, index) => ({ ...group, id: index + 1, orderIndex: index }));
  const componentToElement = new Map<number, number>();
  groups.forEach(group => group.componentIds.forEach(componentId => componentToElement.set(componentId, group.id)));
  const pixelCount = width * height, foregroundPixels = effectiveForeground >= 1 ? pixelCount : components.reduce((sum, item) => sum + item.area, 0);
  const diagnostics = {
    engineVersion: "2.0.0" as const, phase: "segmentation", width, height, pixelCount,
    foregroundPixels, backgroundPixels: pixelCount - foregroundPixels,
    foregroundDensity: effectiveForeground, componentCount: components.length,
    elementCount: groups.length, inputCenterlinePaths: 0, inputContourPaths: 0,
    assignedPaths: 0, splitPaths: 0, tracedComponents: 0, orphanPaths: 0,
    labelsWithoutElements: components.filter(component => !componentToElement.has(component.id)).length,
    componentsWithoutStrokes: 0, rasterPixelsWithoutSeed: 0,
    warnings, durationsMs: { segmentation: now() - started }
  };
  return {
    schemaVersion: 2, width, height, rasterLabels: labels, components, elements: groups.map((group, index) => ({ ...group, orderIndex: index })),
    background: foreground.background, foregroundDensity: effectiveForeground, backend, diagnostics
  };
}
