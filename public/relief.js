import { contours as d3contours } from 'd3-contour';
import { Shape, Path, ExtrudeGeometry } from 'three';

/** Parse "#rrggbb" → [r,g,b]. */
export function hexToRgb(hex) {
  const h = (hex || '').replace('#', '');
  return [parseInt(h.slice(0,2),16)||0, parseInt(h.slice(2,4),16)||0, parseInt(h.slice(4,6),16)||0];
}

/**
 * Snap every pixel to its NEAREST colour in a fixed palette (Euclidean RGB).
 * Unlike k-means this invents no muddy intermediate shades — each label maps to
 * an exact design colour, giving clean layers for multi-material 3MF printing.
 * @param {ImageData} imageData
 * @param {string[]} hexPalette  e.g. ['#0d2e8a','#000000','#ffffff','#1a1a2e']
 * @returns {{ palette: number[][], labels: Int32Array }}
 */
export function quantizeToPalette(imageData, hexPalette) {
  const { data, width, height } = imageData;
  const n = width * height;
  const palette = hexPalette.map(hexToRgb);
  const labels = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
    let best = 0, bd = Infinity;
    for (let c = 0; c < palette.length; c++) {
      const dr=r-palette[c][0], dg=g-palette[c][1], db=b-palette[c][2];
      const d = dr*dr + dg*dg + db*db;
      if (d < bd) { bd = d; best = c; }
    }
    labels[i] = best;
  }
  return { palette, labels };
}

/**
 * Tiny deterministic k-means over RGB. Seeds clusters by evenly sampling the
 * luma-sorted pixels so results are reproducible (no Math.random).
 * @returns {{ palette: number[][], labels: Int32Array }}
 */
export function quantize(imageData, k) {
  const { data, width, height } = imageData;
  const n = width * height;
  const px = new Array(n);
  for (let i = 0; i < n; i++) px[i] = [data[i*4], data[i*4+1], data[i*4+2]];

  const order = [...px.keys()].sort((a, b) =>
    (px[a][0]*0.299+px[a][1]*0.587+px[a][2]*0.114) -
    (px[b][0]*0.299+px[b][1]*0.587+px[b][2]*0.114));
  let centers = [];
  for (let c = 0; c < k; c++) centers.push(px[order[Math.floor((c + 0.5) * n / k)]].slice());

  const labels = new Int32Array(n);
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = px[i][0]-centers[c][0], dg = px[i][1]-centers[c][1], db = px[i][2]-centers[c][2];
        const d = dr*dr + dg*dg + db*db;
        if (d < bd) { bd = d; best = c; }
      }
      labels[i] = best;
    }
    const sums = Array.from({ length: k }, () => [0,0,0,0]);
    for (let i = 0; i < n; i++) {
      const c = labels[i]; sums[c][0]+=px[i][0]; sums[c][1]+=px[i][1]; sums[c][2]+=px[i][2]; sums[c][3]++;
    }
    let moved = false;
    for (let c = 0; c < k; c++) {
      if (!sums[c][3]) continue;
      const nc = [sums[c][0]/sums[c][3], sums[c][1]/sums[c][3], sums[c][2]/sums[c][3]];
      if (nc[0]!==centers[c][0]||nc[1]!==centers[c][1]||nc[2]!==centers[c][2]) moved = true;
      centers[c] = nc;
    }
    if (!moved) break;
  }
  const palette = centers.map(c => c.map(Math.round));
  return { palette, labels };
}

/** Uint8 mask (1 where label === colorIndex). */
export function maskForColor(labels, colorIndex, { width, height }) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) mask[i] = labels[i] === colorIndex ? 1 : 0;
  return mask;
}

/**
 * Ramer-Douglas-Peucker simplification for a CLOSED ring: drops points that
 * sit within `tol` pixels of the straight line between their neighbours,
 * keeping only points that mark an actual direction change. d3-contour's
 * marching squares emits a point at EVERY grid-cell crossing regardless of
 * whether that point is a real corner — a long straight or gently-curved
 * raster edge (e.g. a card's outer border, traced across a ~280mm perimeter
 * at 760px working resolution) comes back as thousands of nearly-collinear
 * points. Chaikin smoothing (below) then DOUBLES the point count on every
 * iteration, so smoothing that raw, redundant point set directly is what
 * blew up a single border layer to 370k+ triangles in a real card export.
 * Simplifying first collapses those redundant runs to just the corners that
 * matter, so Chaikin only ever smooths genuine curve structure.
 */
function distToSegment(p, p1, p2) {
  const [x, y] = p, [x1, y1] = p1, [x2, y2] = p2;
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/** Iterative (stack-based, no recursion depth risk on large rings) RDP over
 * an open chain given as indices into `points`; marks survivors in `keep`. */
function rdpChain(points, idxs, tol, keep) {
  if (idxs.length < 3) return;
  const stack = [[0, idxs.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (hi <= lo + 1) continue;
    let maxDist = -1, at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = distToSegment(points[idxs[i]], points[idxs[lo]], points[idxs[hi]]);
      if (d > maxDist) { maxDist = d; at = i; }
    }
    if (maxDist > tol) {
      keep[idxs[at]] = 1;
      stack.push([lo, at], [at, hi]);
    }
  }
}

function ringArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function simplifyRing(points, tol) {
  const n = points.length;
  if (n < 5) return points;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  // Closed ring: split into two open chains at the two points with the
  // largest mutual separation, since RDP is defined for open polylines.
  let b = 1, maxD = 0;
  for (let i = 1; i < n; i++) {
    const d = (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2;
    if (d > maxD) { maxD = d; b = i; }
  }
  keep[b] = 1;
  const chain1 = []; for (let i = 0; i <= b; i++) chain1.push(i);
  const chain2 = []; for (let i = b; i < n; i++) chain2.push(i); chain2.push(0);
  rdpChain(points, chain1, tol, keep);
  rdpChain(points, chain2, tol, keep);
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  if (out.length < 3) return points;
  // Safety net: a THIN shape (a decorative rule line, a narrow letter stroke)
  // can have its width-defining points fall within `tol` of the long axis
  // between its two farthest-apart points — RDP would then strip exactly the
  // points that give the shape its width, collapsing it toward a degenerate
  // sliver that ExtrudeGeometry's earcut triangulation can't cleanly cap
  // (open/boundary edges — a real gap in the print, not just a lost detail).
  // Simplification must never change the shape enough to risk that, so any
  // simplified ring whose area drifts more than 10% from the original is
  // rejected in favour of the untouched original points.
  const originalArea = ringArea(points), simplifiedArea = ringArea(out);
  if (originalArea > 0 && Math.abs(simplifiedArea - originalArea) / originalArea > 0.10) return points;
  return out;
}

/**
 * Chaikin corner-cutting: replaces each vertex of a CLOSED polygon with two
 * points 1/4 and 3/4 of the way along its outgoing edge. d3-contour's
 * marching squares has no curve-fitting step — it just walks pixel-grid
 * boundaries, so every curve (a circle, a rounded-rect corner) comes back as
 * a staircase of axis-aligned micro-steps at the mask's raster resolution.
 * Iterating this cut converges toward the quadratic B-spline through the
 * original points, which rounds exactly that staircase into a smooth curve —
 * the standard cheap fix for "un-stairstepping" a rasterized polygon, and
 * one that doesn't require re-rendering the mask at a much higher (and much
 * slower to quantize/contour) resolution. Collinear runs (straight mask
 * edges) are unaffected: cutting a straight sequence of points yields points
 * that are still collinear, so text strokes and rectangle edges stay crisp —
 * only actual corners/curves get rounded.
 */
function chaikinSmooth(points, iterations) {
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    if (pts.length < 3) break;
    const next = new Array(pts.length * 2);
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      next[i * 2]     = [x0 + (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.25];
      next[i * 2 + 1] = [x0 + (x1 - x0) * 0.75, y0 + (y1 - y0) * 0.75];
    }
    pts = next;
  }
  return pts;
}

/**
 * Contour a binary mask and extrude it.
 * d3-contour returns GeoJSON MultiPolygons: each polygon is [outerRing, ...holeRings].
 * Outer rings are CCW in pixel/y-down space; the Y negation `-y` below reverses
 * winding into THREE's y-up space (outer→CW, holes→CCW), which is exactly the opposite
 * winding THREE.Shape needs for holes to be subtracted correctly. Using `-y` (not
 * `height - y`) keeps the relief in the same [-height, 0] band as the base plate and
 * the sharp QR (which use `-py`), so all layers stay coplanar on one plaque.
 * @param {number} [smoothIterations=3] - Chaikin corner-cutting passes applied
 *        to every ring (after simplification) before building the Shape;
 *        un-stairsteps the raw marching-squares output into smooth curves.
 *        0 disables smoothing.
 * @param {number} [simplifyTolPx=0] - Ramer-Douglas-Peucker tolerance, in
 *        source-raster pixels, applied to every ring BEFORE smoothing (0
 *        disables it — the default). Marching squares emits a point at every
 *        grid-cell crossing regardless of whether it's a real corner, so a
 *        large contour (a card's outer border, say) comes back with
 *        thousands of redundant near-collinear points, and simplifying those
 *        away before Chaikin (which doubles point count per iteration) can
 *        cut triangle counts drastically. BUT: d3-contour's marching squares
 *        can and does produce rings that visit the same grid-corner twice,
 *        threading multiple disjoint regions together (e.g. separate letters
 *        of a text label) via a single shared pinch point — RDP's global
 *        farthest-pair-chord logic has no notion of that structure and can
 *        collapse a 2000+ point multi-glyph ring down to ~4 points, silently
 *        replacing several small shapes with one wildly wrong blob spanning
 *        their combined bounding area. The area-preservation safety check
 *        below does NOT catch this failure mode, because the pinch-point
 *        bridges themselves contribute ~0 area either way — simplifying them
 *        away barely moves the measured area even though it destroys the
 *        shape. Chaikin smoothing alone (this function's real default) has
 *        no such risk: it only ever rounds each edge locally and can't delete
 *        structure, so it faithfully preserves multiply-connected rings.
 *        Simplification is left here, off by default, for future refinement
 *        (e.g. only applying it to rings verified simple/non-self-touching)
 *        rather than deleted outright.
 * @returns {ExtrudeGeometry}
 */
export function maskToGeometry(mask, { width, height, heightMM, pxToMM = 1, smoothIterations = 3, simplifyTolPx = 0 }) {
  const values = Array.from(mask, v => v);
  const polys = d3contours().size([width, height]).thresholds([0.5])(values);
  const shapes = [];
  const process = ring => chaikinSmooth(simplifyTolPx > 0 ? simplifyRing(ring, simplifyTolPx) : ring, smoothIterations);
  for (const multi of polys) {
    for (const ring of multi.coordinates) {
      const outer = process(ring[0]); // ring[0] = outer boundary, ring[1..] = holes
      const shape = new Shape();
      outer.forEach(([x, y], i) => i === 0
        ? shape.moveTo(x * pxToMM, -y * pxToMM)
        : shape.lineTo(x * pxToMM, -y * pxToMM));
      for (let h = 1; h < ring.length; h++) {
        const holePts = process(ring[h]);
        const path = new Path();
        holePts.forEach(([x, y], i) => i === 0
          ? path.moveTo(x * pxToMM, -y * pxToMM)
          : path.lineTo(x * pxToMM, -y * pxToMM));
        shape.holes.push(path);
      }
      shapes.push(shape);
    }
  }
  if (!shapes.length) throw new Error('maskToGeometry: empty mask');
  return new ExtrudeGeometry(shapes, { depth: heightMM, bevelEnabled: false });
}
