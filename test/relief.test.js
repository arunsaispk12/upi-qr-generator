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
