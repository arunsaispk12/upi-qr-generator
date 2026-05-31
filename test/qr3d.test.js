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

test('3MF is multi-material — one part per mesh on separate extruders (Bambu)', async () => {
  const JSZip = require('jszip');
  const m = qrmat.getQrMatrix('https://example.com');
  const bytes = Buffer.from(m.data, 'base64');
  // sharp QR = 2 meshes: white field + black modules.
  const { group } = qr3d.buildSharpQr({ size: m.size, data: bytes },
    { x: 0, y: 0, w: 100, h: 100 }, { cellHeightMM: 1, baseZ: 2 });
  const buf = await qr3d.export3MFBuffer(group);
  const zip = await JSZip.loadAsync(buf);

  // Geometry: a mesh object per colour.
  const model = await zip.file('3D/3dmodel.model').async('string');
  const meshObjects = (model.match(/<object\b[^>]*type="model"/g) || []).length;
  assert.ok(meshObjects >= 2, 'a mesh object per colour (got ' + meshObjects + ')');

  // Bambu multi-material: each part assigned to a distinct extruder.
  const cfg = await zip.file('Metadata/model_settings.config').async('string');
  const extruders = new Set((cfg.match(/key="extruder"\s+value="(\d+)"/g) || [])
    .map(s => s.match(/value="(\d+)"/)[1]));
  assert.ok(extruders.size >= 2, 'parts on separate extruders (got ' + [...extruders].join(',') + ')');

  // Filament colours present in project settings.
  const proj = await zip.file('Metadata/project_settings.config').async('string');
  const colors = new Set((proj.match(/#[0-9A-Fa-f]{6}/g) || []).map(c => c.toLowerCase()));
  assert.ok(colors.size >= 2, 'distinct filament colours (got ' + [...colors].join(',') + ')');
});
