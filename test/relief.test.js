const test = require('node:test');
const assert = require('node:assert');

// relief.js is an ES module; load it dynamically.
let relief;
test.before(async () => { relief = await import('../public/relief.js'); });

function fixtureImageData() {
  // 4x4: left half black (0,0,0), right half white (255,255,255)
  const w = 4, h = 4, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const v = x < 2 ? 0 : 255;
    data[i*4] = v; data[i*4+1] = v; data[i*4+2] = v; data[i*4+3] = 255;
  }
  return { width: w, height: h, data };
}

test('quantizeToPalette snaps pixels to the nearest exact palette colour', () => {
  // black/white fixture + a near-black grey pixel should snap to black, not invent a shade
  const img = fixtureImageData();
  img.data[0]=20; img.data[1]=20; img.data[2]=20; // top-left → near black
  const q = relief.quantizeToPalette(img, ['#000000', '#ffffff']);
  assert.deepStrictEqual(q.palette, [[0,0,0],[255,255,255]]); // exact, no muddy shades
  assert.strictEqual(q.labels[0], 0);  // near-black snaps to black
  assert.strictEqual(q.labels[2], 1);  // white px snaps to white
});

function antiAliasedCircleImage() {
  // Mimics what canvas drawImage(svgLogoImg, ...) actually produces for a
  // solid-black-on-white SVG icon: a hard circle boundary, PLUS one ring of
  // blended grey pixels along that boundary from the renderer's own edge
  // anti-aliasing. This is the exact input buildCenterLogo() (public/qr3d.js)
  // feeds into quantize — reproducing the bug found via a rendered
  // WhatsApp-icon diagnostic: k-means (k=3) on a 2-colour source spawns a 3rd
  // cluster from that anti-alias ring (since k-means always fills every
  // slot), which then gets extruded as its own ~1px-wide ring — too thin to
  // print, and unstable under corner-smoothing (self-intersects), which
  // showed up as a bumpy/dashed "outline" artifact around the icon.
  const w = 60, h = 60, cx = 30, cy = 30, R = 22;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dist = Math.hypot(x - cx + 0.5, y - cy + 0.5);
    // Inside R-1: solid black. Outside R+1: solid white. In between: a grey
    // anti-alias ring, same as a real renderer's edge blending.
    let v;
    if (dist < R - 1) v = 0;
    else if (dist > R + 1) v = 255;
    else v = Math.round(((dist - (R - 1)) / 2) * 255); // linear blend across the 2px band
    const i = (y * w + x) * 4;
    data[i] = data[i+1] = data[i+2] = v; data[i+3] = 255;
  }
  return { width: w, height: h, data };
}

test('quantize (blind k-means) on an anti-aliased 2-colour icon spawns a spurious edge-halo cluster', () => {
  const img = antiAliasedCircleImage();
  const { palette, labels } = relief.quantize(img, 3);
  const counts = new Array(palette.length).fill(0);
  for (const l of labels) counts[l]++;
  // With only 2 REAL colours (black icon, white background) but k=3
  // requested, k-means still fills all 3 slots — the leftover cluster is the
  // anti-alias blend ring, distinguishable as a small slice sitting between
  // the two real clusters' brightness values.
  const sorted = counts.map((n, i) => ({ n, color: palette[i][0] })).sort((a, b) => a.color - b.color);
  assert.strictEqual(sorted.length, 3, 'k=3 always produces 3 clusters, even with only 2 real colours');
  assert.ok(sorted[1].n < sorted[0].n * 0.2 && sorted[1].n < sorted[2].n * 0.2,
    `the middle-brightness cluster is a thin minority halo, not a real design colour (counts=${JSON.stringify(counts)})`);
});

test('quantizeToPalette on the same anti-aliased icon produces exactly the 2 real colours (no halo cluster)', () => {
  const img = antiAliasedCircleImage();
  const { palette, labels } = relief.quantizeToPalette(img, ['#000000', '#ffffff']);
  assert.strictEqual(palette.length, 2, 'only the 2 declared colours exist — no room for a 3rd halo cluster');
  const counts = [0, 0];
  for (const l of labels) counts[l]++;
  assert.ok(counts[0] > 0 && counts[1] > 0, 'both real colours are actually used');
  // Every anti-alias blend pixel must have been snapped to whichever real
  // colour it's closer to — never left to form a mid-brightness minority
  // cluster the way blind quantize() does above.
  assert.deepStrictEqual(palette, [[0,0,0],[255,255,255]]);
});

test('quantize finds 2 clusters and is deterministic on a fixture', () => {
  const a = relief.quantize(fixtureImageData(), 2);
  const b = relief.quantize(fixtureImageData(), 2);
  assert.strictEqual(a.palette.length, 2);
  assert.deepStrictEqual(a.labels, b.labels, 'deterministic labels');
  assert.strictEqual(a.labels[0], a.labels[1]);   // both black px
  assert.notStrictEqual(a.labels[0], a.labels[2]); // black vs white differ
});

test('maskForColor selects exactly the pixels of one cluster', () => {
  const q = relief.quantize(fixtureImageData(), 2);
  const blackLabel = q.labels[0];
  const mask = relief.maskForColor(q.labels, blackLabel, { width: 4, height: 4 });
  const count = mask.reduce((s, v) => s + v, 0);
  assert.strictEqual(count, 8, 'half the 16 pixels');
});

test('maskToGeometry yields a positive-area, bounded geometry', () => {
  const w = 10, h = 10, mask = new Uint8Array(w * h);
  for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) mask[y*w+x] = 1;
  const geo = relief.maskToGeometry(mask, { width: w, height: h, heightMM: 1, pxToMM: 1 });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  assert.ok(bb.max.x - bb.min.x > 0 && bb.max.y - bb.min.y > 0, 'has footprint');
  assert.ok(bb.max.z - bb.min.z > 0, 'has extrude height');
});

test('maskToGeometry smooths staircase edges by default (a rasterized circle/curve is not left blocky)', () => {
  // A filled circle's mask boundary is exactly what d3-contour's marching
  // squares produces for any curved silhouette (a logo outline, a rounded-
  // rect corner): a staircase of axis-aligned pixel steps, since the
  // algorithm has no curve-fitting step. Chaikin smoothing (default
  // smoothIterations=3) should round that staircase into a curve whose
  // footprint area is close to the ideal circle's, not the smaller
  // jagged-boundary area of the raw pixel mask.
  const w = 60, h = 60, cx = 30, cy = 30, R = 22;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx + 0.5, dy = y - cy + 0.5;
    mask[y * w + x] = (dx * dx + dy * dy <= R * R) ? 1 : 0;
  }

  const smoothed = relief.maskToGeometry(mask, { width: w, height: h, heightMM: 1, pxToMM: 1 });
  const jagged   = relief.maskToGeometry(mask, { width: w, height: h, heightMM: 1, pxToMM: 1, smoothIterations: 0 });

  smoothed.computeBoundingBox(); jagged.computeBoundingBox();
  const idealArea = Math.PI * R * R;
  const smoothedSpan = smoothed.boundingBox.max.x - smoothed.boundingBox.min.x;
  const jaggedSpan = jagged.boundingBox.max.x - jagged.boundingBox.min.x;
  // Both should approximate the circle's diameter reasonably (smoothing must
  // not shrink the shape into something unrecognizable)...
  assert.ok(Math.abs(smoothedSpan - 2 * R) < 3, `smoothed span ~matches circle diameter (got ${smoothedSpan})`);
  // ...and smoothing must actually add more, closer-to-curved vertices than
  // the raw jagged contour (a real smoothing effect took place, not a no-op).
  assert.ok(smoothed.attributes.position.count > jagged.attributes.position.count,
    'smoothing adds vertices (rounds the staircase into a curve) vs. the raw jagged contour');
});

test('maskToGeometry subtracts an interior hole (donut produces more geometry than solid)', () => {
  const w = 12, h = 12;
  // solid 8x8 block
  const solid = new Uint8Array(w * h);
  for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) solid[y*w+x] = 1;
  // same block with a 4x4 hole punched out of the centre
  const donut = Uint8Array.from(solid);
  for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) donut[y*w+x] = 0;

  const gSolid = relief.maskToGeometry(solid, { width: w, height: h, heightMM: 1, pxToMM: 1 });
  const gDonut = relief.maskToGeometry(donut, { width: w, height: h, heightMM: 1, pxToMM: 1 });

  // Same outer footprint...
  gSolid.computeBoundingBox(); gDonut.computeBoundingBox();
  assert.deepStrictEqual(
    [gDonut.boundingBox.max.x - gDonut.boundingBox.min.x, gDonut.boundingBox.max.y - gDonut.boundingBox.min.y],
    [gSolid.boundingBox.max.x - gSolid.boundingBox.min.x, gSolid.boundingBox.max.y - gSolid.boundingBox.min.y],
    'donut keeps the outer footprint');
  // ...but the hole adds inner-wall + ring-cap triangles, so more vertices.
  assert.ok(
    gDonut.attributes.position.count > gSolid.attributes.position.count,
    'hole adds geometry (inner walls), so donut has more vertices than the solid block');
});
