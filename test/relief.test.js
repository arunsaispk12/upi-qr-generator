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
