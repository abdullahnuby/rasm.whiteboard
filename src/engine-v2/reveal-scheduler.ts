import type { Point, RevealPlan, RevealSceneInput, StrokePath, TravelSegment } from "./types.js";
import { distance } from "./geometry.js";

function cumulativeLengths(points: readonly Point[]): Float64Array {
  const result = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) result[i] = result[i - 1] + distance(points[i - 1], points[i]);
  return result;
}

export function buildTravelSegments(lines: readonly StrokePath[]): { segments: TravelSegment[]; totalDistance: number } {
  const segments: TravelSegment[] = [];
  let travelled = 0, previous: Point | null = null;
  for (const line of lines) {
    if (line.points.length < 2) continue;
    const first = line.points[0], cumulative = cumulativeLengths(line.points);
    const begin = travelled, penLift = previous ? distance(previous, first) : 0;
    const draw = begin + penLift, end = draw + Math.max(0.01, cumulative[cumulative.length - 1]);
    segments.push({ line, elementId: line.elementId ?? line.shapeId ?? 0, begin, draw, end, cumulative, previous });
    travelled = end; previous = line.points[line.points.length - 1];
  }
  return { segments, totalDistance: travelled };
}

function nearestComponentPixel(labels: Uint32Array, width: number, height: number, x: number, y: number, componentId: number): number {
  const ix = Math.max(0, Math.min(width - 1, Math.round(x))), iy = Math.max(0, Math.min(height - 1, Math.round(y)));
  const direct = iy * width + ix;
  if (labels[direct] === componentId) return direct;
  for (let radius = 1; radius <= 5; radius++) {
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

interface ComponentBounds { minX: number; minY: number; maxX: number; maxY: number; }
function collectComponentBounds(labels: Uint32Array, width: number, height: number): Map<number, ComponentBounds> {
  const bounds = new Map<number, ComponentBounds>();
  for (let pixel = 0; pixel < labels.length; pixel++) {
    const id = labels[pixel];
    if (!id) continue;
    const x = pixel % width, y = (pixel / width) | 0, current = bounds.get(id);
    if (current) {
      current.minX = Math.min(current.minX, x); current.minY = Math.min(current.minY, y);
      current.maxX = Math.max(current.maxX, x); current.maxY = Math.max(current.maxY, y);
    } else bounds.set(id, { minX: x, minY: y, maxX: x, maxY: y });
  }
  return bounds;
}

function scheduleComponent(
  input: RevealSceneInput, componentId: number, elementId: number, windowStart: number, windowEnd: number,
  segments: readonly TravelSegment[], timings: Uint8Array|Uint16Array, coverage: Uint8Array,
  bounds: ComponentBounds, queue: Uint32Array, geodesic: Uint32Array, originTime: Uint8Array|Uint16Array, maximumTime:number
): void {
  const { width, height, rasterLabels, totalDistance } = input;
  const minX = Math.max(0, bounds.minX - 1), maxX = Math.min(width - 1, bounds.maxX + 1);
  const minY = Math.max(0, bounds.minY - 1), maxY = Math.min(height - 1, bounds.maxY + 1);
  const seeds = new Map<number, number>();
  for (const segment of segments) {
    if (segment.elementId !== elementId || segment.line.componentId !== componentId) continue;
    for (let pointIndex = 0; pointIndex < segment.line.points.length; pointIndex++) {
      const point = segment.line.points[pointIndex];
      const pixel = nearestComponentPixel(rasterLabels, width, height, point[0], point[1], componentId);
      if (pixel < 0) continue;
      const travelled = segment.draw + segment.cumulative[Math.min(pointIndex, segment.cumulative.length - 1)];
      const time = Math.max(windowStart, Math.min(windowEnd, Math.floor(maximumTime * travelled / totalDistance)));
      const current = seeds.get(pixel);
      if (current === undefined || time < current) seeds.set(pixel, time);
    }
  }
  if (!seeds.size) throw new Error("Component " + componentId + " has no hand-path seed in element " + elementId + ".");
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const pixel = y * width + x;
    if (rasterLabels[pixel] === componentId) geodesic[pixel] = 0xffffffff;
  }
  let head = 0, tail = 0;
  for (const [pixel, time] of seeds) {
    if (geodesic[pixel] !== 0) { geodesic[pixel] = 0; originTime[pixel] = time; queue[tail++] = pixel; }
    else originTime[pixel] = Math.min(originTime[pixel], time);
  }
  let maximumDistance = 0;
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1], dy = [0, -1, -1, -1, 0, 1, 1, 1];
  while (head < tail) {
    const pixel = queue[head++], x = pixel % width, y = (pixel / width) | 0;
    for (let direction = 0; direction < 8; direction++) {
      const nx = x + dx[direction], ny = y + dy[direction];
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const next = ny * width + nx;
      if (rasterLabels[next] !== componentId || geodesic[next] !== 0xffffffff) continue;
      geodesic[next] = geodesic[pixel] + 1;
      originTime[next] = originTime[pixel];
      maximumDistance = Math.max(maximumDistance, geodesic[next]);
      queue[tail++] = next;
    }
  }
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const pixel = y * width + x;
    if (rasterLabels[pixel] !== componentId) continue;
    const hops = geodesic[pixel];
    if (hops === 0xffffffff) throw new Error("Unreached pixel in connected component " + componentId + ".");
    const timeSpan = Math.max(0, windowEnd - windowStart);
    const seedProgress = timeSpan ? Math.max(0, Math.min(1, (originTime[pixel] - windowStart) / timeSpan)) : 1;
    const spatialProgress = maximumDistance > 0 ? hops / maximumDistance : 1;
    // The legacy spread stretches distance from the pen over the entire remaining
    // element window. That leaves distant edges and Arabic strokes incomplete until
    // the end, even after the hand has passed them. Local spread consumes actual
    // path-distance time instead: a pixel two geodesic steps from a seed trails by
    // two units of physical pen travel, not by most of the element duration.
    const proposed=input.revealSpread==='near-pen'
      ? originTime[pixel]+hops*maximumTime/totalDistance
      : windowStart+(seedProgress+(1-seedProgress)*spatialProgress)*timeSpan;
    timings[pixel] = Math.max(windowStart, Math.min(windowEnd, Math.floor(proposed)));
    coverage[pixel] = 1;
  }
}

export function buildRevealSchedule(input: RevealSceneInput): RevealPlan {
  const { width, height, rasterLabels, lines, shapeGroups } = input;
  const totalPixels = width * height;
  if (rasterLabels.length !== totalPixels) throw new TypeError("Raster ownership map has invalid dimensions.");
  const travel = buildTravelSegments(lines), totalDistance = travel.totalDistance;
  if (!(totalDistance > 0)) throw new Error("Cannot schedule a scene without a physical hand route.");
  const resolution=input.resolution===65536?65536:256,maximumTime=resolution-1,TimingArray=resolution===65536?Uint16Array:Uint8Array;
  const timings = new TimingArray(totalPixels), coverage = new Uint8Array(totalPixels);
  const elementSegments = new Map<number, TravelSegment[]>();
  for (const segment of travel.segments) {
    const list = elementSegments.get(segment.elementId) ?? [];
    list.push(segment); elementSegments.set(segment.elementId, list);
  }
  const elementWindows = shapeGroups.map(group => {
    const segments = elementSegments.get(group.id) ?? [];
    if (!segments.length) throw new Error("Element " + group.id + " has no hand path.");
    return {
      elementId: group.id,
      start: Math.max(0, Math.floor(maximumTime * segments[0].draw / totalDistance)),
      end: Math.min(maximumTime, Math.ceil(maximumTime * segments[segments.length - 1].end / totalDistance))
    };
  });
  const boundsByLabel = collectComponentBounds(rasterLabels, width, height);
  const queue = new Uint32Array(totalPixels), geodesic = new Uint32Array(totalPixels), originTime = new TimingArray(totalPixels);
  const unseededComponents: number[] = [];
  for (const group of shapeGroups) {
    const window = elementWindows.find(item => item.elementId === group.id)!;
    for (const componentId of group.rasterComponentLabels) {
      const bounds = boundsByLabel.get(componentId);
      if (!bounds) { unseededComponents.push(componentId); continue; }
      try {
        scheduleComponent({ ...input, totalDistance }, componentId, group.id, window.start, window.end,
          elementSegments.get(group.id) ?? [], timings, coverage, bounds, queue, geodesic, originTime,maximumTime);
      } catch (error) {
        unseededComponents.push(componentId);
      }
    }
  }
  if (unseededComponents.length) throw new Error("Components without hand-seeded reveal routes: " + [...new Set(unseededComponents)].join(", "));
  let backgroundPixels = 0;
  for (let pixel = 0; pixel < totalPixels; pixel++) if (rasterLabels[pixel] === 0) {
    timings[pixel] = 0; coverage[pixel] = 1; backgroundPixels++;
  }
  let scheduledPixels = 0, unscheduledPixels = 0;
  for (const value of coverage) { if (value) scheduledPixels++; else unscheduledPixels++; }
  if (unscheduledPixels) throw new Error(unscheduledPixels + " source pixels have no reveal timestamp.");
  const ends = new Uint32Array(resolution+1);
  for (const time of timings) ends[time + 1]++;
  for (let index = 1; index < ends.length; index++) ends[index] += ends[index - 1];
  const cursor = ends.slice(), order = new Uint32Array(totalPixels);
  for (let pixel = 0; pixel < totalPixels; pixel++) order[cursor[timings[pixel]]++] = pixel;
  return {
    order, ends, timings, totalPixels, totalDistance, elementWindows,
    diagnostics: { scheduledPixels, backgroundPixels, unscheduledPixels, unseededComponents: [] }
  };
}
