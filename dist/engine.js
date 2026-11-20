'use strict';
(function (root) {
  const DX = [-1, -1, 0, 1, 1, 1, 0, -1];
  const DY = [0, -1, -1, -1, 0, 1, 1, 1];
  const BITS = new Uint8Array(256);
  for (let i = 1; i < 256; i++) BITS[i] = BITS[i >> 1] + (i & 1);

  function luminanceAndBlur(data, width, height) {
    const size = width * height, gray = new Uint8Array(size), blur = new Uint8Array(size);
    for (let i = 0, p = 0; i < size; i++, p += 4) gray[i] = Math.round(data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114);
    for (let y = 0; y < height; y++) {
      const ym = Math.max(0, y - 1), yp = Math.min(height - 1, y + 1);
      for (let x = 0; x < width; x++) {
        const xm = Math.max(0, x - 1), xp = Math.min(width - 1, x + 1);
        const sum = gray[ym * width + xm] + 2 * gray[y * width + xm] + gray[yp * width + xm] +
          2 * gray[ym * width + x] + 4 * gray[y * width + x] + 2 * gray[yp * width + x] +
          gray[ym * width + xp] + 2 * gray[y * width + xp] + gray[yp * width + xp];
        blur[y * width + x] = sum >> 4;
      }
    }
    return blur;
  }

  function percentileThreshold(values, options) {
    const histogram = new Uint32Array(2041);
    let count = 0;
    for (let i = 0; i < values.length; i++) if (values[i] > 0) {
      histogram[Math.min(2040, Math.round(values[i]))]++;
      count++;
    }
    if (!count) return { high: 36, low: 15 };
    const percentile = Number.isFinite(options.percentile) ? options.percentile : 0.72;
    const target = Math.max(1, Math.ceil(count * Math.min(0.95, Math.max(0.35, percentile))));
    let seen = 0, high = 36;
    for (let i = 1; i < histogram.length; i++) {
      seen += histogram[i];
      if (seen >= target) { high = i; break; }
    }
    high = Math.min(180, Math.max(32, high));
    return { high, low: Math.max(12, high * 0.42) };
  }

  function suppressNonMaximum(magnitude, gx, gy, width, height) {
    const thin = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const p = y * width + x, m = magnitude[p];
      if (!m) continue;
      const ax = Math.abs(gx[p]), ay = Math.abs(gy[p]);
      let before, after;
      if (ax >= ay * 2) {
        before = magnitude[p - 1]; after = magnitude[p + 1];
      } else if (ay >= ax * 2) {
        before = magnitude[p - width]; after = magnitude[p + width];
      } else if ((gx[p] < 0) === (gy[p] < 0)) {
        before = magnitude[p - width - 1]; after = magnitude[p + width + 1];
      } else {
        before = magnitude[p - width + 1]; after = magnitude[p + width - 1];
      }
      if (m >= before && m >= after) thin[p] = m;
    }
    return thin;
  }

  function hysteresis(thin, width, height, thresholds) {
    const size = width * height, state = new Uint8Array(size), queue = new Int32Array(size);
    let head = 0, tail = 0;
    for (let p = 0; p < size; p++) {
      if (thin[p] >= thresholds.high) { state[p] = 2; queue[tail++] = p; }
      else if (thin[p] >= thresholds.low) state[p] = 1;
    }
    while (head < tail) {
      const p = queue[head++], x = p % width, y = (p / width) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const q = ny * width + nx;
        if (state[q] === 1) { state[q] = 2; queue[tail++] = q; }
      }
    }
    const edges = new Uint8Array(size);
    for (let p = 0; p < size; p++) if (state[p] === 2) edges[p] = 1;
    return { edges, count: tail };
  }

  function buildAdjacency(edges, width, height) {
    const size = width * height, adjacency = new Uint8Array(size), degree = new Uint8Array(size);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!edges[p]) continue;
      let bits = 0;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && edges[ny * width + nx]) bits |= 1 << d;
      }
      adjacency[p] = bits; degree[p] = BITS[bits];
    }
    return { adjacency, degree };
  }

  function firstDirection(bits) {
    for (let d = 0; d < 8; d++) if (bits & (1 << d)) return d;
    return -1;
  }

  function simplifyPolyline(points, tolerance) {
    if (points.length <= 2) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]], limit2 = tolerance * tolerance;
    while (stack.length) {
      const [first, last] = stack.pop(), a = points[first], b = points[last];
      const dx = b[0] - a[0], dy = b[1] - a[1], denominator = dx * dx + dy * dy;
      let farthest = limit2, index = -1;
      for (let i = first + 1; i < last; i++) {
        const p = points[i];
        let t = denominator ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denominator : 0;
        t = Math.max(0, Math.min(1, t));
        const ex = p[0] - (a[0] + t * dx), ey = p[1] - (a[1] + t * dy), distance = ex * ex + ey * ey;
        if (distance > farthest) { farthest = distance; index = i; }
      }
      if (index >= 0) { keep[index] = 1; stack.push([first, index], [index, last]); }
    }
    const result = [];
    for (let i = 0; i < points.length; i++) if (keep[i]) result.push(points[i]);
    return result;
  }

  function resamplePolyline(points, step) {
    if (points.length <= 2) return points;
    const output = [points[0]];
    let carry = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dx = b[0] - a[0], dy = b[1] - a[1];
      const segment = Math.hypot(dx, dy);
      if (!segment) continue;
      let distance = step - carry;
      while (distance < segment) {
        const t = distance / segment;
        output.push([a[0] + dx * t, a[1] + dy * t]);
        distance += step;
      }
      carry = (carry + segment) % step;
    }
    const last = points[points.length - 1], end = output[output.length - 1];
    if (end[0] !== last[0] || end[1] !== last[1]) output.push(last);
    return output;
  }

  function foregroundMask(data, width, height) {
    const step = Math.max(1, Math.floor(Math.min(width, height) / 160));
    const samples = [[], [], []];
    function sample(x, y) {
      const p = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) samples[c].push(data[p + c]);
    }
    for (let x = 0; x < width; x += step) {
      sample(x, 0); sample(x, height - 1);
    }
    for (let y = step; y < height - 1; y += step) {
      sample(0, y); sample(width - 1, y);
    }
    const background = samples.map(values => {
      values.sort((a, b) => a - b);
      return values[values.length >> 1] || 255;
    });
    const bgLuma = background[0] * .299 + background[1] * .587 + background[2] * .114;
    const darkForeground = bgLuma >= 128;
    const mask = new Uint8Array(width * height);
    let count = 0;
    for (let p = 0, q = 0; p < mask.length; p++, q += 4) {
      const r = data[q], g = data[q + 1], b = data[q + 2];
      const lum = r * .299 + g * .587 + b * .114;
      const delta = darkForeground ? bgLuma - lum : lum - bgLuma;
      const colorDistance = Math.hypot((r - background[0]) * .82, g - background[1], (b - background[2]) * .82);
      if (delta >= 24 || colorDistance >= 52) { mask[p] = 1; count++; }
    }
    const density = count / mask.length;
    if (density < .0012 || density > .32) return null;
    return { mask, density, background };
  }

  function thinForeground(source, width, height) {
    const mask = source.slice(), remove = new Uint8Array(source.length);
    let iterations = 0, changed = true;
    while (changed && iterations < 48) {
      changed = false;
      for (let phase = 0; phase < 2; phase++) {
        let marked = 0;
        for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
          const p = y * width + x;
          if (!mask[p]) continue;
          const p2 = mask[p - width], p3 = mask[p - width + 1];
          const p4 = mask[p + 1], p5 = mask[p + width + 1];
          const p6 = mask[p + width], p7 = mask[p + width - 1];
          const p8 = mask[p - 1], p9 = mask[p - width - 1];
          const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (neighbors < 2 || neighbors > 6) continue;
          const ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let transitions = 0;
          for (let i = 0; i < 8; i++) if (!ring[i] && ring[i + 1]) transitions++;
          if (transitions !== 1) continue;
          const removeCondition = phase === 0
            ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0
            : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0;
          if (removeCondition) { remove[p] = 1; marked++; }
        }
        if (marked) {
          changed = true;
          for (let p = 0; p < mask.length; p++) if (remove[p]) { mask[p] = 0; remove[p] = 0; }
        }
      }
      iterations++;
    }
    return { mask, iterations };
  }

  function extractCenterlinePaths(data, width, height) {
    const foreground = foregroundMask(data, width, height);
    if (!foreground) return { lines: [], length: 0, metrics: { available: false, reason: 'background-or-density' } };
    const thinned = thinForeground(foreground.mask, width, height);
    const { adjacency, degree } = buildAdjacency(thinned.mask, width, height);
    const paths = [];
    let discarded = 0;
    function removeEdge(p, q, direction) {
      adjacency[p] &= ~(1 << direction);
      adjacency[q] &= ~(1 << ((direction + 4) & 7));
    }
    function trace(start, first) {
      const points = [[start % width, (start / width) | 0]];
      let current = start, direction = first, guard = 0;
      while (direction >= 0 && guard++ <= width * height) {
        const x = current % width, y = (current / width) | 0;
        const next = (y + DY[direction]) * width + x + DX[direction];
        if (next < 0 || next >= width * height) break;
        removeEdge(current, next, direction);
        current = next;
        points.push([current % width, (current / width) | 0]);
        if (current === start || degree[current] !== 2) break;
        direction = firstDirection(adjacency[current]);
      }
      return points;
    }
    function collect(points) {
      if (points.length < 2) return;
      let distance = 0, red = 0, green = 0, blue = 0;
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const x = Math.max(0, Math.min(width - 1, Math.round(point[0])));
        const y = Math.max(0, Math.min(height - 1, Math.round(point[1])));
        const index = (y * width + x) * 4;
        red += data[index]; green += data[index + 1]; blue += data[index + 2];
        if (i) distance += Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]);
      }
      if (distance < 3.5) { discarded++; return; }
      let smooth = resamplePolyline(simplifyPolyline(points, .8), 1.5);
      const first = smooth[0], last = smooth[smooth.length - 1];
      const closed = Math.hypot(first[0] - last[0], first[1] - last[1]) < .01;
      if (!closed) {
        const dx = last[0] - first[0], dy = last[1] - first[1];
        if ((Math.abs(dx) >= Math.abs(dy) && first[0] < last[0]) ||
            (Math.abs(dx) < Math.abs(dy) && first[1] > last[1])) smooth = smooth.slice().reverse();
      }
      paths.push({
        points: smooth,
        color: 'rgb(' + [red, green, blue].map(v => Math.round(v / points.length * .82)).join(',') + ')',
        centerX: points.reduce((sum, p) => sum + p[0], 0) / points.length,
        centerY: points.reduce((sum, p) => sum + p[1], 0) / points.length
      });
    }
    for (let p = 0; p < degree.length; p++) {
      if (!degree[p] || degree[p] === 2) continue;
      while (adjacency[p]) {
        const direction = firstDirection(adjacency[p]);
        if (direction < 0) break;
        collect(trace(p, direction));
      }
    }
    for (let p = 0; p < degree.length; p++) while (adjacency[p]) {
      const direction = firstDirection(adjacency[p]);
      if (direction < 0) break;
      collect(trace(p, direction));
    }
    paths.sort((a, b) =>
      (Math.floor(a.centerY / 7) - Math.floor(b.centerY / 7)) ||
      (b.centerX - a.centerX) || (a.centerY - b.centerY)
    );
    let length = 0;
    const lines = paths.map(path => {
      const line = { points: path.points, color: path.color, start: length };
      length += path.points.length;
      return line;
    });
    return {
      lines, length,
      metrics: {
        available: lines.length > 0, paths: lines.length, discardedPaths: discarded,
        foregroundDensity: foreground.density, thinningIterations: thinned.iterations
      }
    };
  }

  function extractPaths(data, width, height, options) {
    options = options || {};
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3 || !data || data.length !== width * height * 4) {
      throw new TypeError('Invalid image pixel buffer or dimensions');
    }
    const size = width * height, blur = luminanceAndBlur(data, width, height);
    const gx = new Int16Array(size), gy = new Int16Array(size), magnitude = new Float32Array(size);
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const a = blur[p - width - 1], b = blur[p - width], c = blur[p - width + 1];
      const d = blur[p - 1], f = blur[p + 1], g = blur[p + width - 1], h = blur[p + width], i = blur[p + width + 1];
      const sx = -a + c - 2 * d + 2 * f - g + i, sy = -a - 2 * b - c + g + 2 * h + i;
      gx[p] = sx; gy[p] = sy; magnitude[p] = Math.hypot(sx, sy);
    }
    const thin = suppressNonMaximum(magnitude, gx, gy, width, height);
    const thresholds = percentileThreshold(thin, options);
    const linked = hysteresis(thin, width, height, thresholds);
    const { adjacency, degree } = buildAdjacency(linked.edges, width, height);
    const minLength = Number.isFinite(options.minPathLength) ? options.minPathLength : 3.5;
    const tolerance = Number.isFinite(options.simplifyTolerance) ? options.simplifyTolerance : 0.75;
    const paths = [];
    let discarded = 0;

    function removeEdge(p, q, direction) {
      adjacency[p] &= ~(1 << direction);
      adjacency[q] &= ~(1 << ((direction + 4) & 7));
    }
    function trace(start, first) {
      const points = [[start % width, (start / width) | 0]];
      let current = start, direction = first, guard = 0;
      while (direction >= 0 && guard++ <= size) {
        const x = current % width, y = (current / width) | 0;
        const next = (y + DY[direction]) * width + x + DX[direction];
        if (next < 0 || next >= size) break;
        removeEdge(current, next, direction);
        current = next; points.push([current % width, (current / width) | 0]);
        if (current === start || degree[current] !== 2) break;
        direction = firstDirection(adjacency[current]);
      }
      return points;
    }
    function collect(points) {
      if (points.length < 2) return;
      let distance = 0, red = 0, green = 0, blue = 0;
      for (let i = 0; i < points.length; i++) {
        const point = points[i], x = Math.max(0, Math.min(width - 1, Math.round(point[0])));
        const y = Math.max(0, Math.min(height - 1, Math.round(point[1]))), index = (y * width + x) * 4;
        red += data[index]; green += data[index + 1]; blue += data[index + 2];
        if (i) distance += Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]);
      }
      if (distance < minLength) { discarded++; return; }
      const smooth = resamplePolyline(simplifyPolyline(points, tolerance), 1.25), count = points.length;
      paths.push({
        points: smooth,
        color: 'rgb(' + [red, green, blue].map(v => Math.round(v / count * 0.82)).join(',') + ')',
        centerX: points.reduce((sum, p) => sum + p[0], 0) / count,
        centerY: points.reduce((sum, p) => sum + p[1], 0) / count
      });
    }
    for (let p = 0; p < size; p++) {
      if (!degree[p] || degree[p] === 2) continue;
      while (adjacency[p]) {
        const direction = firstDirection(adjacency[p]);
        if (direction < 0) break;
        collect(trace(p, direction));
      }
    }
    for (let p = 0; p < size; p++) while (adjacency[p]) {
      const direction = firstDirection(adjacency[p]);
      if (direction < 0) break;
      collect(trace(p, direction));
    }
    paths.sort((a, b) => (Math.floor(a.centerY / 4) - Math.floor(b.centerY / 4)) || (a.centerX - b.centerX) || (a.centerY - b.centerY));
    let length = 0;
    const lines = paths.map(path => {
      const line = { points: path.points, color: path.color, start: length };
      length += path.points.length;
      return line;
    });
    const centerline = extractCenterlinePaths(data, width, height);
    return {
      lines, length,
      centerLines: centerline.lines, centerLength: centerline.length, centerMetrics: centerline.metrics,
      metrics: { width, height, edgePixels: linked.count, paths: lines.length, discardedPaths: discarded,
        highThreshold: Math.round(thresholds.high), lowThreshold: Math.round(thresholds.low) }
    };
  }

  function prepareSource(img) {
    const scale = Math.min(960 / img.width, 720 / img.height, 1);
    const width = Math.max(3, Math.round(img.width * scale)), height = Math.max(3, Math.round(img.height * scale));
    const src = root.document.createElement('canvas');
    src.width = width; src.height = height;
    const context = src.getContext('2d', { willReadFrequently: true });
    context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
    context.drawImage(img, 0, 0, width, height);
    return { src, width, height, pixels: context.getImageData(0, 0, width, height).data };
  }
  function makeScene(name, source, result, handHint) {
    const defaults = { speed: 0.5, mode: 'original', tone: 4, sourceHand: 'auto', handSize: 100,
      weight: 1.4, side: '1', hold: 18, paper: '#ffffff', transition: 'cut' };
    return { name, src: source.src, baseLines: result.lines, centerBaseLines: result.centerLines || [], centerMetrics: result.centerMetrics || null, motionStyle: 'smart', zones: [], handHint: !!handHint,
      thumb: source.src.toDataURL('image/jpeg', 0.65), lines: result.centerLines && result.centerLines.length ? result.centerLines : result.lines, length: result.centerLines && result.centerLines.length ? result.centerLength : result.length,
      duration: 6, engineVersion: 4, metrics: result.metrics, ...defaults };
  }

  let worker = null, requestId = 0;
  const pending = new Map();
  function getWorker() {
    if (typeof root.Worker !== 'function') return null;
    if (worker) return worker;
    try {
      worker = new root.Worker('engine-worker.js');
      worker.onmessage = event => {
        const task = pending.get(event.data.id);
        if (!task) return;
        pending.delete(event.data.id);
        if (event.data.error) task.reject(new Error(event.data.error));
        else task.resolve(event.data.result);
      };
      worker.onerror = error => {
        for (const task of pending.values()) task.reject(error);
        pending.clear(); worker.terminate(); worker = null;
      };
      return worker;
    } catch { return null; }
  }
  function analyze(img, name) {
    const source = prepareSource(img);
    const handHint = typeof root.edgeSkinRegion === 'function' ? root.edgeSkinRegion(source.pixels, source.width, source.height) : false;
    return makeScene(name, source, extractPaths(source.pixels, source.width, source.height), handHint);
  }
  async function analyzeAsync(img, name) {
    const source = prepareSource(img);
    const handHint = typeof root.edgeSkinRegion === 'function' ? root.edgeSkinRegion(source.pixels, source.width, source.height) : false;
    const activeWorker = getWorker();
    if (!activeWorker) return makeScene(name, source, extractPaths(source.pixels, source.width, source.height), handHint);
    const id = ++requestId;
    let result;
    try {
      result = await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        activeWorker.postMessage({ id, width: source.width, height: source.height, pixels: source.pixels.buffer }, [source.pixels.buffer]);
      });
    } catch {
      const pixels = source.src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, source.width, source.height).data;
      result = extractPaths(pixels, source.width, source.height);
    }
    return makeScene(name, source, result, handHint);
  }
  root.RasmImageEngine = { analyze, analyzeAsync, extractPaths, simplifyPolyline, resamplePolyline };
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));
