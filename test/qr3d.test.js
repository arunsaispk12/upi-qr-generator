const test = require('node:test');
const assert = require('node:assert');

let qr3d, qrmat;
test.before(async () => {
  qr3d = await import('../public/qr3d.js');
  qrmat = require('../src/qr-matrix');
});

test('buildSharpQr makes one box per dark module', async () => {
  const m = qrmat.getQrMatrix('https://example.com');
  const bytes = Buffer.from(m.data, 'base64');
  let dark = 0; for (const b of bytes) if (b === 1) dark++;
  const { group, boxCount } = qr3d.buildSharpQr(
    { size: m.size, data: bytes },
    { x: 0, y: 0, w: 100, h: 100 }, { cellHeightMM: 1, baseZ: 2 });
  assert.strictEqual(boxCount, dark, 'one merged box instance per dark module');
  assert.ok(group.children.length >= 1);
});

test('exportSTL serializes every QR module (not collapsed to one cube)', async () => {
  const m = qrmat.getQrMatrix('https://example.com');
  const bytes = Buffer.from(m.data, 'base64');
  let dark = 0; for (const b of bytes) if (b === 1) dark++;
  const { group } = qr3d.buildSharpQr({ size: m.size, data: bytes },
    { x: 0, y: 0, w: 100, h: 100 }, { cellHeightMM: 1, baseZ: 2 });
  const buf = await qr3d.exportSTLBuffer(group);
  assert.ok(buf.length > 84, 'binary STL header + at least one triangle');
  // Binary STL stores the triangle count as a uint32 at byte offset 80.
  const tris = buf.readUInt32LE(80);
  // 12 triangles per box: field plate (1) + every dark module merged in.
  assert.strictEqual(tris, 12 * (1 + dark), 'all module boxes are present in the STL');
});
