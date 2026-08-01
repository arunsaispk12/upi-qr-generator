const test = require('node:test');
const assert = require('node:assert');
const jsQRmod = require('jsqr');
const jsQR = jsQRmod.default || jsQRmod;

let qr3d, qrmat, THREE;
test.before(async () => {
  qr3d = await import('../public/qr3d.js');
  qrmat = require('../src/qr-matrix');
  THREE = await import('three');
});

function shoelaceArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    a += p1.x * p2.y - p2.x * p1.y;
  }
  return a / 2;
}

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

test('roundedRectWithTabShape adds a tab bulge and a genuine hole, for every edge position', async () => {
  for (const edge of [0, 1, 2, 3]) {
    const tab = { edge, tabDiameter: 12, holeDiameter: 5 };
    const shape = qr3d.roundedRectWithTabShape(100, 80, 4, tab);
    assert.strictEqual(shape.holes.length, 1, `edge ${edge}: hole present`);

    const outerArea = shoelaceArea(shape.getPoints());
    assert.ok(outerArea > 100 * 80, `edge ${edge}: tab bulge adds area beyond the plain rect`);

    const holeArea = Math.abs(shoelaceArea(shape.holes[0].getPoints()));
    const expectedHoleArea = Math.PI * 2.5 * 2.5;
    assert.ok(Math.abs(holeArea - expectedHoleArea) < 1,
      `edge ${edge}: hole area ~matches a 5mm-diameter circle (got ${holeArea.toFixed(2)})`);

    // Must triangulate cleanly (a self-intersecting union/hole would throw or
    // produce degenerate — zero-vertex — geometry here).
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
    assert.ok(geo.attributes.position.count > 0, `edge ${edge}: extrudes to a non-empty mesh`);
  }
});

test('roundedRectWithTabShape: the hole actually removes material (not silently ignored)', async () => {
  const withHole = qr3d.roundedRectWithTabShape(100, 80, 4, { edge: 0, tabDiameter: 12, holeDiameter: 5 });
  const noHole = qr3d.roundedRectWithTabShape(100, 80, 4, { edge: 0, tabDiameter: 12, holeDiameter: 0 });
  const vertsWith = new THREE.ExtrudeGeometry(withHole, { depth: 2, bevelEnabled: false }).attributes.position.count;
  const vertsWithout = new THREE.ExtrudeGeometry(noHole, { depth: 2, bevelEnabled: false }).attributes.position.count;
  assert.ok(vertsWith > vertsWithout, 'the hole ring contributes extra wall geometry');

  // The tab centre (where the hole sits) must fall inside the outer contour
  // AND inside the hole ring — i.e. it's genuinely punched through, not just
  // an unused decorative path.
  function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  const outerPts = withHole.getPoints();
  const holePts = withHole.holes[0].getPoints();
  const tabCentreScene = { x: 50, y: 12 * 0.25 }; // edge 0 (top): scene y = +0.25*tabDiameter
  assert.ok(pointInPolygon(tabCentreScene.x, tabCentreScene.y, outerPts), 'tab centre is within the plate outline');
  assert.ok(pointInPolygon(tabCentreScene.x, tabCentreScene.y, holePts), 'tab centre is within the hole ring');
});

test('roundedRectWithTabShape: the QR-rect cutout is a real hole, with or without a keyring tab', async () => {
  const qrHoleRect = { x: 20, y: 15, w: 40, h: 40 };
  for (const tab of [null, { edge: 1, tabDiameter: 12, holeDiameter: 5 }]) {
    const shape = qr3d.roundedRectWithTabShape(100, 80, 4, tab, qrHoleRect);
    const expectedHoles = tab ? 2 : 1;
    assert.strictEqual(shape.holes.length, expectedHoles,
      `holes present (tab=${!!tab}): expected ${expectedHoles}`);

    // The QR-rect hole's area should match the rect exactly (it's a plain
    // axis-aligned rectangle, no arcs to approximate).
    const qrHole = shape.holes[shape.holes.length - 1]; // pushed after the tab hole, if any
    const area = Math.abs(shoelaceArea(qrHole.getPoints()));
    assert.ok(Math.abs(area - qrHoleRect.w * qrHoleRect.h) < 1e-6,
      `QR-rect hole area matches ${qrHoleRect.w}x${qrHoleRect.h} (tab=${!!tab}, got ${area})`);

    // Must still triangulate cleanly with both holes present.
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
    assert.ok(geo.attributes.position.count > 0, `extrudes to a non-empty mesh (tab=${!!tab})`);
  }
});
