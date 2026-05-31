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
 * Contour a binary mask and extrude it.
 * d3-contour returns GeoJSON MultiPolygons: each polygon is [outerRing, ...holeRings].
 * Outer rings are CCW in pixel/y-down space; the Y negation `-y` below reverses
 * winding into THREE's y-up space (outer→CW, holes→CCW), which is exactly the opposite
 * winding THREE.Shape needs for holes to be subtracted correctly. Using `-y` (not
 * `height - y`) keeps the relief in the same [-height, 0] band as the base plate and
 * the sharp QR (which use `-py`), so all layers stay coplanar on one plaque.
 * @param {number} [simplifyTol=0] - Reserved for future polygon simplification; currently unused.
 * @returns {ExtrudeGeometry}
 */
export function maskToGeometry(mask, { width, height, heightMM, pxToMM = 1, simplifyTol = 0 }) {
  const values = Array.from(mask, v => v);
  const polys = d3contours().size([width, height]).thresholds([0.5])(values);
  const shapes = [];
  for (const multi of polys) {
    for (const ring of multi.coordinates) {
      const outer = ring[0]; // ring[0] = outer boundary, ring[1..] = holes
      const shape = new Shape();
      outer.forEach(([x, y], i) => i === 0
        ? shape.moveTo(x * pxToMM, -y * pxToMM)
        : shape.lineTo(x * pxToMM, -y * pxToMM));
      for (let h = 1; h < ring.length; h++) {
        const path = new Path();
        ring[h].forEach(([x, y], i) => i === 0
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
