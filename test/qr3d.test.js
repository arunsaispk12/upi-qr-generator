const test = require('node:test');
const assert = require('node:assert');
const jsQRmod = require('jsqr');
const jsQR = jsQRmod.default || jsQRmod;

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

test('sharp QR rasterized top-down decodes back to the original string', async () => {
  const s = 'https://example.com/scan-gate';
  const m = qrmat.getQrMatrix(s);
  const bytes = Buffer.from(m.data, 'base64');
  const img = qr3d.rasterizeQrMatrix({ size: m.size, data: bytes }, 8); // 8px/module
  const res = jsQR(img.data, img.width, img.height);
  assert.ok(res, 'jsQR decoded the rasterized QR');
  assert.strictEqual(res.data, s);
});

test('export3MF returns a zip (3MF) buffer', async () => {
  const m = qrmat.getQrMatrix('https://example.com');
  const bytes = Buffer.from(m.data, 'base64');
  const { group } = qr3d.buildSharpQr({ size: m.size, data: bytes },
    { x: 0, y: 0, w: 100, h: 100 }, { cellHeightMM: 1, baseZ: 2 });
  const buf = await qr3d.export3MFBuffer(group);
  assert.strictEqual(buf[0], 0x50); assert.strictEqual(buf[1], 0x4b); // PK zip header
  assert.ok(buf.length > 100);
});
