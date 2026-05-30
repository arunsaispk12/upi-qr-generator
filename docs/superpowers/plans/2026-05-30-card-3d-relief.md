# Card → 3D Relief Plaque Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the rendered branded QR card into a multi-color 3D relief plaque that can be previewed in-page (rotate/zoom) and downloaded as a print-ready 3MF (multi-color) or STL (single-color) file.

**Architecture:** The server returns the QR module matrix alongside the existing PNG/SCAD response. The client renders the card to a canvas (already does this), then a pure image-processing module (`relief.js`) k-means-quantizes the pixels to ~4 colors and turns each color mask into extruded geometry via `d3-contour`. `qr3d.js` assembles a `THREE.Group` (base plate + per-color relief meshes + a sharp QR rebuilt from the matrix), drives a WebGL preview, and serializes to STL/3MF. All 3D work is client-side and lazy-built on first switch to a new "3D Model" tab.

**Tech Stack:** Node.js, Express, `qrcode` (matrix); browser ES modules `three`, `d3-contour`, `three-3mf-exporter`; vanilla JS classic-script `app.js` bridging to `window.QR3D`; Node built-in test runner (`node:test`) with optional `canvas` for `getImageData`.

**Source of truth:** `docs/superpowers/specs/2026-05-30-card-3d-relief-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/qr-matrix.js` | **Create** | `getQrMatrix(qrString) → {size, data(base64)}` from the `qrcode` lib |
| `src/server.js` | **Modify** (`/api/generate`, ~line 89) | Add `qrMatrix` field to the JSON response |
| `public/app.js` | **Modify** (builders ~539/891, callers ~254/330; tab + export wiring) | Builders return `{dataUrl, canvas, layout}`; store last build; wire 3D tab + export buttons; drop OpenSCAD UI |
| `public/relief.js` | **Create** (ES module) | `quantize`, `maskForColor`, `maskToGeometry` — pure, Node-testable |
| `public/qr3d.js` | **Create** (ES module) | `build`, `mountPreview`/`disposePreview`, `exportSTL`, `export3MF`; exposes `window.QR3D` |
| `public/vendor/*` | **Create** (committed ESM) | `three`, `OrbitControls`, `STLExporter`, `three-3mf-exporter`, `d3-contour` |
| `public/index.html` | **Modify** | Import map for vendor modules; "3D Model" tab + `<canvas>`; Download 3MF/STL buttons; remove OpenSCAD/STL card |
| `public/style.css` | **Extend** | 3D tab/viewer styles |
| `src/server.js` | **Modify** (remove) | Drop `/api/openscad-status` + `/api/download/stl` routes |
| `package.json` | **Modify** | Add `three`, `d3-contour`, `three-3mf-exporter`, `jsqr` as devDependencies; add `test` script |
| `test/qr-matrix.test.js` | **Create** | matrix shape + dark-module count |
| `test/relief.test.js` | **Create** | k-means determinism; mask→geometry bbox/area |
| `test/qr3d.test.js` | **Create** | sharp-QR box count; STL non-empty; 3MF is a zip with N color objects; jsQR scannability gate |
| `README.md` | **Modify** | Document 3D feature, formats, limitations |

---

## Task 1: QR matrix module + server wiring

**Files:**
- Create: `src/qr-matrix.js`
- Test: `test/qr-matrix.test.js`
- Modify: `package.json` (add `test` script)
- Modify: `src/server.js` (response at ~line 89)

- [ ] **Step 1: Add a test script to package.json**

In `package.json`, add to `"scripts"`:

```json
    "test": "node --test"
```

- [ ] **Step 2: Write the failing test**

Create `test/qr-matrix.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { getQrMatrix } = require('../src/qr-matrix');

test('getQrMatrix returns size and base64 data of length size*size', () => {
  const m = getQrMatrix('upi://pay?pa=test@upi&pn=Test');
  assert.ok(m.size >= 21 && m.size % 2 === 1, 'odd module size >= 21');
  const bytes = Buffer.from(m.data, 'base64');
  assert.strictEqual(bytes.length, m.size * m.size, 'one byte per module');
});

test('getQrMatrix dark-module bytes are 0/1 and there is at least one dark', () => {
  const m = getQrMatrix('https://example.com');
  const bytes = Buffer.from(m.data, 'base64');
  let dark = 0;
  for (const b of bytes) { assert.ok(b === 0 || b === 1); if (b === 1) dark++; }
  assert.ok(dark > 0, 'matrix has dark modules');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/qr-matrix.test.js`
Expected: FAIL — `Cannot find module '../src/qr-matrix'`.

- [ ] **Step 4: Implement src/qr-matrix.js**

Create `src/qr-matrix.js`:

```js
const QRCode = require('qrcode');

/**
 * Build the QR module matrix for a string at error-correction level H.
 * Returns { size, data } where data is base64 of a size*size byte array,
 * each byte 1 (dark module) or 0 (light).
 */
function getQrMatrix(qrString) {
  const qr = QRCode.create(qrString, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const src = qr.modules.data; // Uint8Array, 1 = dark
  const out = Buffer.alloc(size * size);
  for (let i = 0; i < out.length; i++) out[i] = src[i] ? 1 : 0;
  return { size, data: out.toString('base64') };
}

module.exports = { getQrMatrix };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test test/qr-matrix.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Wire qrMatrix into /api/generate**

In `src/server.js`, add the require near the other requires at the top:

```js
const { getQrMatrix } = require('./qr-matrix');
```

In the `/api/generate` handler, after `const qrString = typeDef.buildQrString(req.body);` (line ~61), the `qrString` is already in scope. In the `res.json({ ... })` object (line ~89), add a `qrMatrix` field:

```js
    res.json({
      success:       true,
      qrString,
      qrMatrix:      getQrMatrix(qrString),
      scadFile:      scadResult.isZip
        ? scadResult.content.toString('base64')
        : scadResult.content,
      isZip:         scadResult.isZip,
      filename:      scadResult.filename,
      pngBase64:     pngResult.buffer.toString('base64'),
      canvasMissing: pngResult.canvasMissing || false,
    });
```

- [ ] **Step 7: Verify the server returns qrMatrix**

Run (PowerShell):
```powershell
Start-Job { node src/server.js } | Out-Null; Start-Sleep 2
$r = Invoke-RestMethod -Uri http://localhost:3000/api/generate -Method Post -ContentType 'application/json' -Body '{"mode":"url","url":"https://example.com"}'
"size=$($r.qrMatrix.size) dataLen=$($r.qrMatrix.data.Length)"
Get-Job | Stop-Job; Get-Job | Remove-Job
```
Expected: non-zero `size` (odd, ≥21) and a non-empty base64 `data` string.

- [ ] **Step 8: Commit**

```bash
git add src/qr-matrix.js src/server.js package.json test/qr-matrix.test.js
git commit -m "feat: qr module matrix + qrMatrix in /api/generate response"
```

---

## Task 2: Builders return { dataUrl, canvas, layout } and store last build

The 3D feature needs the rendered pixels, the QR rectangle, and palette hints. `buildUpiCard`/`buildServiceCard` currently `return out.toDataURL('image/png')`. Change them to return `{ dataUrl, canvas, layout }` (pure addition — `dataUrl` preserves the old value) and update the two callers.

**Files:**
- Modify: `public/app.js` (`buildUpiCard` ~539–858, `buildServiceCard` ~891–1017, callers ~254 and ~330, plus a small module-level store)

- [ ] **Step 1: Add a module-level store for the last 3D-capable build**

Near the top of `public/app.js` where `state` is defined, add a field for the last card build and matrix. Find the `state` object literal and add:

```js
  lastCard: null,   // { canvas, layout } from the most recent successful build
  qrMatrix: null,   // { size, data } base64 from the server, or null offline
```

- [ ] **Step 2: Change buildUpiCard's return**

In `buildUpiCard` (`public/app.js`), the function computes the QR box with (pre-scale coords): `QS=380, qbPad=10`, `qbX=M+(W-qbSz)/2`, `qbY=y+8`, and draws the QR at `qbX+qbPad, qbY+qbPad, QS, QS`. The canvas is scaled by `SC=2`. At the end the function does `return out.toDataURL('image/png');` (line ~858).

The QR draw coords are inside the function scope. Capture them into a layout object right after the QR is drawn (after line ~742, `ctx.drawImage(qrEl, qbX+qbPad, qbY+qbPad, QS, QS);`):

```js
  // Device-pixel rect of the QR field (canvas is scaled by SC), for the 3D relief.
  const qrRect = {
    x: (qbX + qbPad) * SC, y: (qbY + qbPad) * SC,
    w: QS * SC, h: QS * SC,
  };
```

Then replace the final `return out.toDataURL('image/png');` with:

```js
  return {
    dataUrl: out.toDataURL('image/png'),
    canvas: out,
    layout: { qrRect, paletteHints: [pc, bgColor, '#ffffff', '#000000'] },
  };
```

- [ ] **Step 3: Change buildServiceCard's return**

In `buildServiceCard` (`public/app.js`, ~891), the QR box uses `W=500, M=12, SC=2, QS=380`, `qbPad=10`, and draws at `qbX+qbPad, qbY+qbPad, QS, QS` (line ~991). After that `ctx.drawImage(...)` line add:

```js
  const qrRect = {
    x: (qbX + qbPad) * SC, y: (qbY + qbPad) * SC,
    w: QS * SC, h: QS * SC,
  };
```

Replace the final `return out.toDataURL('image/png');` (line ~1017) with:

```js
  return {
    dataUrl: out.toDataURL('image/png'),
    canvas: out,
    layout: { qrRect, paletteHints: [cfg.color || '#1a1a2e', '#ffffff', '#000000'] },
  };
```

> Note: `buildServiceCard` derives a `cfg` object (action text/colors). Use whatever the existing primary color variable in that function is for `paletteHints[0]`; if it is named differently than `cfg.color`, use that name. The hints only seed k-means and need not be exact.

- [ ] **Step 4: Update buildFinalCard and its callers to use .dataUrl, and record lastCard**

`buildFinalCard` (`public/app.js` ~280) returns the builder result directly. Change it to capture the build and return the object unchanged:

```js
async function buildFinalCard(qrElement, data) {
  let userLogoImg = null;
  if (data.logoDataUrl) {
    userLogoImg = await new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = data.logoDataUrl;
    });
  }
  let result;
  if (data.mode === 'upi') {
    result = await buildUpiCard(qrElement, userLogoImg, data);
  } else {
    const typeDef    = QR_TYPES[data.mode];
    const svcLogoImg = typeDef && typeDef.logoName ? await loadBadge(typeDef.logoName) : null;
    result = await buildServiceCard(qrElement, userLogoImg, svcLogoImg, data);
  }
  state.lastCard = { canvas: result.canvas, layout: result.layout };
  return result;
}
```

Caller at line ~254 (`canvasMissing` path) does `const cardDataUrl = await buildCardFromPlainQR(...)` then `.replace(...)`. `buildCardFromPlainQR` (line ~271) returns `buildFinalCard(...)`. Update that path to read `.dataUrl`:

```js
      const card = await buildCardFromPlainQR('data:image/png;base64,' + result.pngBase64, data);
      displayPng = card.dataUrl.replace(/^data:image\/png;base64,/, '');
```

Caller in `generateClientSide` at line ~330 (`const pngDataURL = await buildFinalCard(qrCanvas, data);`) — update to:

```js
  const card = await buildFinalCard(qrCanvas, data);
  const pngDataURL = card.dataUrl;
```

- [ ] **Step 5: Record the server qrMatrix; clear it in the offline path**

In `generate()` (the API-success branch, ~line 247 where `const result = await res.json();` is parsed), after parsing, store the matrix:

```js
    state.qrMatrix = result.qrMatrix || null;
```

In `generateClientSide()` (offline fallback), there is no server matrix — set it null near the top:

```js
  state.qrMatrix = null;
```

Also reset `state.lastCard = null` at the very start of `generate()` so a stale 3D model is never reused after a failed run.

- [ ] **Step 6: Manual smoke test in the browser**

Run: `npm start`, open `http://localhost:3000`, generate a UPI card. In the browser console run:
```js
JSON.stringify({ hasCanvas: !!state.lastCard?.canvas, qrRect: state.lastCard?.layout?.qrRect, matrixSize: state.qrMatrix?.size })
```
Expected: `hasCanvas:true`, a `qrRect` with positive `w`/`h`, and a non-null `matrixSize`. Confirm the PNG preview still renders normally (no regression).

- [ ] **Step 7: Commit**

```bash
git add public/app.js
git commit -m "feat: card builders also return {canvas, layout}; capture qrMatrix"
```

---

## Task 3: Vendor browser ES modules + add dev dependencies

`relief.js`/`qr3d.js` use bare specifiers (`import ... from 'three'`) so the same code runs in Node tests (resolved from `node_modules`) and the browser (resolved by an import map → `public/vendor`).

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `public/vendor/three.module.js`, `public/vendor/OrbitControls.js`, `public/vendor/STLExporter.js`, `public/vendor/three-3mf-exporter.js`, `public/vendor/d3-contour.js`
- Modify: `public/index.html` (import map)

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install --save-dev three d3-contour three-3mf-exporter jsqr
```
Expected: `package.json` gains these under `devDependencies`; `node_modules` populated.

- [ ] **Step 2: Copy the ESM builds into public/vendor**

Run (PowerShell):
```powershell
New-Item -ItemType Directory -Force public/vendor | Out-Null
Copy-Item node_modules/three/build/three.module.js          public/vendor/three.module.js
Copy-Item node_modules/three/examples/jsm/controls/OrbitControls.js public/vendor/OrbitControls.js
Copy-Item node_modules/three/examples/jsm/exporters/STLExporter.js  public/vendor/STLExporter.js
```
For `three-3mf-exporter` and `d3-contour`, copy their ESM entry (check `package.json` `module`/`exports` field of each — typically `dist/*.esm.js` or `+esm`). If `d3-contour`'s npm build imports `d3-array` (bare specifier), either also vendor `d3-array` and map it, or download the self-contained jsDelivr ESM bundle:
```powershell
Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/npm/d3-contour@4/+esm' -OutFile public/vendor/d3-contour.js
Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/npm/three-3mf-exporter@<version>/+esm' -OutFile public/vendor/three-3mf-exporter.js
```
> Pick whichever produces a self-contained module with no unmapped bare imports. Open each vendored file and confirm its only bare `import ... from` is `'three'` (which the import map covers) — internal helpers should be inlined.

- [ ] **Step 3: Add the import map to index.html**

In `public/index.html`, in `<head>` **before** any module script, add:

```html
<script type="importmap">
{
  "imports": {
    "three": "/vendor/three.module.js",
    "three/addons/controls/OrbitControls.js": "/vendor/OrbitControls.js",
    "three/addons/exporters/STLExporter.js": "/vendor/STLExporter.js",
    "three-3mf-exporter": "/vendor/three-3mf-exporter.js",
    "d3-contour": "/vendor/d3-contour.js"
  }
}
</script>
```
> If a vendored addon imports `three` via a relative path (`../../../build/three.module.js`) rather than the bare `'three'`, edit its import line to `import ... from 'three';` so the map applies and the singleton is shared.

- [ ] **Step 4: Verify the browser can load three via the map**

Run `npm start`, open the page, and in the console:
```js
import('three').then(m => console.log('three', m.REVISION))
```
Expected: logs a three.js revision number (no module-resolution error).

- [ ] **Step 5: Verify Node can resolve the same specifiers**

Run:
```bash
node -e "import('three').then(t=>console.log('three',t.REVISION)); import('d3-contour').then(d=>console.log('contours', typeof d.contours))"
```
Expected: prints the revision and `contours function`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json public/vendor public/index.html
git commit -m "chore: vendor three + addons + d3-contour + 3mf exporter; import map"
```

---

## Task 4: relief.js — k-means quantize + mask→geometry (TDD)

**Files:**
- Create: `public/relief.js`
- Test: `test/relief.test.js`

- [ ] **Step 1: Write failing tests for quantize + mask**

Create `test/relief.test.js`:

```js
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
  // each column-half maps to one consistent label
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
  // solid 6x6 block in a 10x10 field
  const w = 10, h = 10, mask = new Uint8Array(w * h);
  for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) mask[y*w+x] = 1;
  const geo = relief.maskToGeometry(mask, { width: w, height: h, heightMM: 1, pxToMM: 1 });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  assert.ok(bb.max.x - bb.min.x > 0 && bb.max.y - bb.min.y > 0, 'has footprint');
  assert.ok(bb.max.z - bb.min.z > 0, 'has extrude height');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/relief.test.js`
Expected: FAIL — cannot find `../public/relief.js`.

- [ ] **Step 3: Implement public/relief.js**

Create `public/relief.js`:

```js
import { contours as d3contours } from 'd3-contour';
import { Shape, Path, ExtrudeGeometry } from 'three';

/**
 * Tiny deterministic k-means over RGB. Seeds clusters by evenly sampling the
 * sorted unique-ish colour space so results are reproducible (no Math.random).
 * @returns {{ palette: number[][], labels: Int32Array }}
 */
export function quantize(imageData, k) {
  const { data, width, height } = imageData;
  const n = width * height;
  const px = new Array(n);
  for (let i = 0; i < n; i++) px[i] = [data[i*4], data[i*4+1], data[i*4+2]];

  // Deterministic seeding: sort by luma, pick k evenly spaced samples.
  const order = [...px.keys()].sort((a, b) =>
    (px[a][0]*0.299+px[a][1]*0.587+px[a][2]*0.114) -
    (px[b][0]*0.299+px[b][1]*0.587+px[b][2]*0.114));
  let centers = [];
  for (let c = 0; c < k; c++) centers.push(px[order[Math.floor((c + 0.5) * n / k)]].slice());

  const labels = new Int32Array(n);
  for (let iter = 0; iter < 12; iter++) {
    // assign
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = px[i][0]-centers[c][0], dg = px[i][1]-centers[c][1], db = px[i][2]-centers[c][2];
        const d = dr*dr + dg*dg + db*db;
        if (d < bd) { bd = d; best = c; }
      }
      labels[i] = best;
    }
    // update
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
 * @returns {ExtrudeGeometry}
 */
export function maskToGeometry(mask, { width, height, heightMM, pxToMM = 1, simplifyTol = 0 }) {
  // d3-contour wants a number array; threshold at 0.5.
  const values = Array.from(mask, v => v);
  const polys = d3contours().size([width, height]).thresholds([0.5])(values);
  const shapes = [];
  for (const multi of polys) {
    for (const ring of multi.coordinates) {
      // ring[0] = outer boundary (CW in d3), ring[1..] = holes
      const outer = ring[0];
      const shape = new Shape();
      outer.forEach(([x, y], i) => i === 0
        ? shape.moveTo(x * pxToMM, (height - y) * pxToMM)
        : shape.lineTo(x * pxToMM, (height - y) * pxToMM));
      for (let h = 1; h < ring.length; h++) {
        const path = new Path();
        ring[h].forEach(([x, y], i) => i === 0
          ? path.moveTo(x * pxToMM, (height - y) * pxToMM)
          : path.lineTo(x * pxToMM, (height - y) * pxToMM));
        shape.holes.push(path);
      }
      shapes.push(shape);
    }
  }
  if (!shapes.length) throw new Error('maskToGeometry: empty mask');
  return new ExtrudeGeometry(shapes, { depth: heightMM, bevelEnabled: false });
}
```
> `simplifyTol` is reserved for a later optimization pass and intentionally unused in v1 — keep the param so the signature is stable.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/relief.test.js`
Expected: PASS (3 tests). If `quantize` determinism fails, confirm no `Math.random` slipped in.

- [ ] **Step 5: Commit**

```bash
git add public/relief.js test/relief.test.js
git commit -m "feat: relief.js k-means quantize + mask-to-geometry with tests"
```

---

## Task 5: qr3d.js — assemble group + sharp QR (TDD on the testable parts)

**Files:**
- Create: `public/qr3d.js`
- Test: `test/qr3d.test.js`

- [ ] **Step 1: Write failing tests for sharp-QR box count + STL/3MF export**

Create `test/qr3d.test.js`:

```js
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

test('exportSTL returns a non-empty binary STL blob/buffer', async () => {
  const m = qrmat.getQrMatrix('https://example.com');
  const bytes = Buffer.from(m.data, 'base64');
  const { group } = qr3d.buildSharpQr({ size: m.size, data: bytes },
    { x: 0, y: 0, w: 100, h: 100 }, { cellHeightMM: 1, baseZ: 2 });
  const buf = await qr3d.exportSTLBuffer(group);  // Node-friendly variant
  assert.ok(buf.length > 84, 'binary STL header + at least one triangle');
});
```
> `exportSTLBuffer` is a thin Node-testable wrapper that returns a Buffer; `exportSTL` (browser) wraps the same serializer in a `Blob`. Keep both.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/qr3d.test.js`
Expected: FAIL — cannot find `../public/qr3d.js`.

- [ ] **Step 3: Implement public/qr3d.js (core geometry + exporters first)**

Create `public/qr3d.js`. Start with the parts the tests cover, plus the assembly/preview/export API:

```js
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { quantize, maskForColor, maskToGeometry } from './relief.js';

/**
 * Sharp QR: white field plate + one InstancedMesh of boxes for dark modules,
 * positioned within `qrRect` (device px → mm via rect.w mapping).
 * @returns {{ group: THREE.Group, boxCount: number }}
 */
export function buildSharpQr(matrix, qrRect, { cellHeightMM, baseZ }) {
  const group = new THREE.Group();
  const cellMM = qrRect.w / matrix.size; // device px per module; rect already in working units
  // white field
  const field = new THREE.Mesh(
    new THREE.BoxGeometry(qrRect.w, qrRect.h, baseZ),
    new THREE.MeshStandardMaterial({ color: 0xffffff }));
  field.position.set(qrRect.x + qrRect.w/2, -(qrRect.y + qrRect.h/2), baseZ/2);
  group.add(field);

  // count dark modules
  let dark = 0;
  for (let i = 0; i < matrix.size * matrix.size; i++) if (matrix.data[i] === 1) dark++;

  const inst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(cellMM, cellMM, cellHeightMM),
    new THREE.MeshStandardMaterial({ color: 0x000000 }), Math.max(dark, 1));
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.data[row * matrix.size + col] !== 1) continue;
      const px = qrRect.x + (col + 0.5) * cellMM;
      const py = qrRect.y + (row + 0.5) * cellMM;
      dummy.position.set(px, -py, baseZ + cellHeightMM/2);
      dummy.updateMatrix();
      inst.setMatrixAt(n++, dummy.matrix);
    }
  }
  inst.count = n;
  group.add(inst);
  return { group, boxCount: n };
}

/**
 * Assemble the full plaque: base plate + per-colour relief meshes (QR region
 * excluded from segmentation) + sharp QR.
 * @returns {THREE.Group}
 */
export function build(canvas, layout, matrix, opts = {}) {
  const k = opts.colors || 4;
  const longEdgeMM = opts.longEdgeMM || 100;
  const baseT = opts.baseThickness || 2;
  const layerH = opts.layerHeight || 0.8;

  // Downsample to ~targetLong px on the long edge.
  const targetLong = opts.workPx || 350;
  const scale = targetLong / Math.max(canvas.width, canvas.height);
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  const sctx = small.getContext('2d');
  sctx.drawImage(canvas, 0, 0, w, h);
  const img = sctx.getImageData(0, 0, w, h);

  // Blank the QR region so it does not pollute segmentation (filled later, sharp).
  const r = layout.qrRect, qx = Math.round(r.x*scale), qy = Math.round(r.y*scale),
        qw = Math.round(r.w*scale), qh = Math.round(r.h*scale);
  for (let y = qy; y < qy + qh; y++) for (let x = qx; x < qx + qw; x++) {
    const i = (y*w + x)*4; img.data[i]=img.data[i+1]=img.data[i+2]=255;
  }

  const pxToMM = longEdgeMM / Math.max(w, h);
  const group = new THREE.Group();

  // Base plate = full footprint at thickness baseT.
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(w*pxToMM, h*pxToMM, baseT),
    new THREE.MeshStandardMaterial({ color: rgbHex(dominant(img)) }));
  plate.position.set(w*pxToMM/2, -h*pxToMM/2, baseT/2);
  group.add(plate);

  // Per-colour relief layers (skip the base/dominant colour).
  const { palette, labels } = quantize(img, k);
  const baseIdx = dominantLabel(labels, k);
  for (let c = 0; c < k; c++) {
    if (c === baseIdx) continue;
    try {
      const mask = maskForColor(labels, c, { width: w, height: h });
      if (mask.reduce((s,v)=>s+v,0) === 0) continue;
      const geo = maskToGeometry(mask, { width: w, height: h, heightMM: layerH, pxToMM });
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: rgbHex(palette[c]) }));
      mesh.position.z = baseT; // sit on the plate
      group.add(mesh);
    } catch (e) { console.warn('relief layer skipped', c, e.message); }
  }

  // Sharp QR in working-mm coords.
  const qrRectMM = { x: r.x*scale*pxToMM, y: r.y*scale*pxToMM, w: r.w*scale*pxToMM, h: r.h*scale*pxToMM };
  const { group: qrGroup } = buildSharpQr(matrix, qrRectMM, { cellHeightMM: layerH, baseZ: baseT });
  group.add(qrGroup);
  return group;
}

function rgbHex([r,g,b]) { return (r<<16)|(g<<8)|b; }
function dominant(img) { /* average colour as a cheap base tint */
  let r=0,g=0,b=0,n=img.width*img.height;
  for (let i=0;i<n;i++){r+=img.data[i*4];g+=img.data[i*4+1];b+=img.data[i*4+2];}
  return [Math.round(r/n),Math.round(g/n),Math.round(b/n)];
}
function dominantLabel(labels, k) {
  const c = new Array(k).fill(0); for (const l of labels) c[l]++;
  return c.indexOf(Math.max(...c));
}

/** Browser: STL Blob. */
export function exportSTL(group) {
  const stl = new STLExporter().parse(group, { binary: true });
  return new Blob([stl], { type: 'model/stl' });
}
/** Node-testable: STL Buffer. */
export async function exportSTLBuffer(group) {
  const stl = new STLExporter().parse(group, { binary: true });
  return Buffer.from(stl.buffer || stl);
}

if (typeof window !== 'undefined') window.QR3D = { build, buildSharpQr, exportSTL };
```
> `MeshStandardMaterial` needs no renderer to construct, so the Node tests run headless. Preview + 3MF export are added next.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/qr3d.test.js`
Expected: PASS (2 tests). The box count equals the dark-module count.

- [ ] **Step 5: Commit**

```bash
git add public/qr3d.js test/qr3d.test.js
git commit -m "feat: qr3d core — plaque assembly, sharp QR, STL export with tests"
```

---

## Task 6: Scannability gate (jsQR) + 3MF export

**Files:**
- Modify: `public/qr3d.js` (add `export3MF`, add an orthographic QR rasterizer for the gate)
- Modify: `test/qr3d.test.js` (add scannability + 3MF tests)

- [ ] **Step 1: Write the failing scannability + 3MF tests**

Append to `test/qr3d.test.js`:

```js
const jsQR = require('jsqr');

test('sharp QR rasterized top-down decodes back to the original string', async () => {
  const s = 'https://example.com/scan-gate';
  const m = qrmat.getQrMatrix(s);
  const bytes = Buffer.from(m.data, 'base64');
  // Rasterize the matrix the same way buildSharpQr places modules.
  const img = qr3d.rasterizeQrMatrix({ size: m.size, data: bytes }, 8); // 8px/module
  const res = jsQR(img.data, img.width, img.height);
  assert.ok(res, 'jsQR decoded the rasterized QR');
  assert.strictEqual(res.data, s);
});

test('export3MF returns a zip containing one object per colour', async () => {
  const m = qrmat.getQrMatrix('https://example.com');
  const bytes = Buffer.from(m.data, 'base64');
  const { group } = qr3d.buildSharpQr({ size: m.size, data: bytes },
    { x: 0, y: 0, w: 100, h: 100 }, { cellHeightMM: 1, baseZ: 2 });
  const buf = await qr3d.export3MFBuffer(group);
  // 3MF is a zip → starts with PK\x03\x04
  assert.strictEqual(buf[0], 0x50); assert.strictEqual(buf[1], 0x4b);
  assert.ok(buf.length > 100);
});
```
> The scannability gate validates the matrix→geometry placement is faithful by rasterizing modules with the same row/col mapping `buildSharpQr` uses, then decoding with jsQR. This is the spec's "must pass" gate at the geometry level (a full top-down render needs WebGL and is covered in manual verification).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/qr3d.test.js`
Expected: FAIL — `qr3d.rasterizeQrMatrix`/`export3MFBuffer` undefined.

- [ ] **Step 3: Implement rasterizeQrMatrix + 3MF export**

Add to `public/qr3d.js`:

```js
import { to3dmf } from 'three-3mf-exporter';

/**
 * Rasterize the QR matrix into RGBA pixels using the SAME row/col→position
 * mapping as buildSharpQr, for the decode gate. Dark=black, light=white,
 * with a 4-module quiet zone.
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export function rasterizeQrMatrix(matrix, px) {
  const q = 4, dim = (matrix.size + q*2) * px;
  const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let i = 3; i < data.length; i += 4) data[i] = 255; // alpha
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.data[row*matrix.size + col] !== 1) continue;
      for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) {
        const x = (q+col)*px + dx, y = (q+row)*px + dy, idx = (y*dim + x)*4;
        data[idx]=0; data[idx+1]=0; data[idx+2]=0; data[idx+3]=255;
      }
    }
  }
  return { data, width: dim, height: dim };
}

/** Browser: 3MF Blob, one object per colour. */
export async function export3MF(group) {
  const buf = await to3dmf(group);            // ArrayBuffer
  return new Blob([buf], { type: 'model/3mf' });
}
/** Node-testable: 3MF Buffer. */
export async function export3MFBuffer(group) {
  const buf = await to3dmf(group);
  return Buffer.from(buf);
}
```
> Confirm the actual exported function name of `three-3mf-exporter` (commonly `to3dmf(group) → Promise<ArrayBuffer>`). If the installed version exports a class/different name, adapt these two wrappers — the rest of the code calls only `export3MF`/`export3MFBuffer`. Update the `window.QR3D` assignment to also expose `export3MF`.

- [ ] **Step 4: Expose export3MF on window.QR3D**

Update the bottom of `public/qr3d.js`:

```js
if (typeof window !== 'undefined') window.QR3D = { build, buildSharpQr, exportSTL, export3MF };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test`
Expected: ALL tests pass across `test/` — including the jsQR gate and the 3MF zip check.

- [ ] **Step 6: Commit**

```bash
git add public/qr3d.js test/qr3d.test.js
git commit -m "feat: 3MF export + jsQR scannability gate for sharp QR"
```

---

## Task 7: 3D Model tab + WebGL preview (browser wiring)

**Files:**
- Modify: `public/qr3d.js` (add `mountPreview`/`disposePreview` using OrbitControls)
- Modify: `public/index.html` (3D tab + viewer canvas; load `qr3d.js` as a module)
- Modify: `public/app.js` (tab switch → lazy build + mount)
- Modify: `public/style.css` (viewer styles)

- [ ] **Step 1: Add preview mount/dispose to qr3d.js**

Add to `public/qr3d.js`:

```js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let _renderer, _controls, _raf;
export function mountPreview(group, canvasEl) {
  disposePreview();
  if (!window.WebGLRenderingContext) throw new Error('NO_WEBGL');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14142a);
  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  group.position.sub(c); // center at origin
  scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(1,1,2); scene.add(dir);

  const cam = new THREE.PerspectiveCamera(45, canvasEl.clientWidth/canvasEl.clientHeight, 0.1, 5000);
  cam.position.set(0, 0, Math.max(sz.x, sz.y, sz.z) * 2.2);
  _renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  _renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight, false);
  _controls = new OrbitControls(cam, canvasEl);
  (function loop(){ _raf = requestAnimationFrame(loop); _controls.update(); _renderer.render(scene, cam); })();
}
export function disposePreview() {
  if (_raf) cancelAnimationFrame(_raf);
  if (_controls) _controls.dispose();
  if (_renderer) _renderer.dispose();
  _renderer = _controls = _raf = null;
}
```
Update `window.QR3D` to also expose `mountPreview`, `disposePreview`.

- [ ] **Step 2: Add the 3D tab + viewer to index.html and remove the OpenSCAD/STL card**

In `public/index.html`:
- Add a tab button "3D Model" next to the existing preview/download area, and a panel:
  ```html
  <section id="tab3d" class="hidden">
    <canvas id="viewer3d" width="480" height="480"></canvas>
    <p class="hint">Drag to rotate · scroll to zoom</p>
    <div class="export3d">
      <button id="btn3mf" disabled>Download 3MF</button>
      <button id="btnStlNew" disabled>Download STL</button>
    </div>
    <p id="msg3d" class="hint"></p>
  </section>
  ```
- Remove the OpenSCAD detection card (`stlCard`) and the old "Direct STL via OpenSCAD" UI.
- Load the module at the end of `<body>` (after `app.js`):
  ```html
  <script type="module" src="/qr3d.js"></script>
  ```

- [ ] **Step 3: Wire the tab switch in app.js (lazy build + mount)**

In `public/app.js`, add a handler that, when the "3D Model" tab is activated:

```js
function show3DTab() {
  const msg = $('msg3d');
  if (!state.lastCard || !state.qrMatrix) {
    msg.textContent = state.qrMatrix
      ? 'Generate a card first.'
      : '3D needs the server (offline mode unsupported).';
    return;
  }
  try {
    const matrix = {
      size: state.qrMatrix.size,
      data: Uint8Array.from(atob(state.qrMatrix.data), c => c.charCodeAt(0)),
    };
    const group = window.QR3D.build(state.lastCard.canvas, state.lastCard.layout, matrix, {});
    state.group3d = group;
    window.QR3D.mountPreview(group, $('viewer3d'));
    $('btn3mf').disabled = false; $('btnStlNew').disabled = false;
    msg.textContent = '';
  } catch (e) {
    msg.textContent = e.message === 'NO_WEBGL'
      ? 'No WebGL — preview unavailable, but downloads still work.'
      : '3D build failed: ' + e.message;
    // exports may still work without WebGL
    if (state.group3d) { $('btn3mf').disabled = false; $('btnStlNew').disabled = false; }
  }
}
```
Hook this into the existing tab-switch logic (call `show3DTab()` when the 3D tab becomes active; call `window.QR3D.disposePreview()` when leaving it). Rebuild on each new Generate by clearing `state.group3d = null` in `generate()`.

- [ ] **Step 4: Style the viewer**

Append to `public/style.css`:

```css
#viewer3d { width: 100%; max-width: 480px; aspect-ratio: 1; border-radius: 12px; background: #14142a; display: block; margin: 0 auto; }
.export3d { display: flex; gap: 12px; justify-content: center; margin-top: 12px; }
#tab3d .hint { text-align: center; color: var(--muted, #777); }
```

- [ ] **Step 5: Manual verification**

Run `npm start`, generate a UPI card, switch to the 3D Model tab. Expected: a rotatable plaque appears — black base, raised gold/white elements, a crisp QR block. Drag rotates; scroll zooms. Scan the on-screen QR with a phone — it should resolve to the UPI string.

- [ ] **Step 6: Commit**

```bash
git add public/qr3d.js public/index.html public/app.js public/style.css
git commit -m "feat: 3D Model tab with WebGL preview; remove OpenSCAD UI card"
```

---

## Task 8: Export buttons, route cleanup, docs

**Files:**
- Modify: `public/app.js` (3MF/STL button handlers)
- Modify: `src/server.js` (remove `/api/openscad-status` + `/api/download/stl`)
- Modify: `README.md`

- [ ] **Step 1: Wire the export buttons**

In `public/app.js`, add click handlers:

```js
$('btn3mf').addEventListener('click', async () => {
  if (!state.group3d) return;
  const blob = await window.QR3D.export3MF(state.group3d);
  downloadBlob(blob, safeName(getFormData()) + '_card.3mf');
  showStatus('3MF downloaded', 'ok');
});
$('btnStlNew').addEventListener('click', () => {
  if (!state.group3d) return;
  const blob = window.QR3D.exportSTL(state.group3d);
  downloadBlob(blob, safeName(getFormData()) + '_card.stl');
  showStatus('STL downloaded', 'ok');
});
```
> Reuses the existing `downloadBlob` and `safeName` helpers.

- [ ] **Step 2: Remove the OpenSCAD server routes**

In `src/server.js`, delete the `app.get('/api/openscad-status', ...)` handler (~line 178) and the `/api/download/stl` handler. Remove now-unused requires (e.g. the `exec`/OpenSCAD probe) only if nothing else uses them. Leave `/api/download/scad` intact (SCAD download still offered).

- [ ] **Step 3: Remove dead OpenSCAD client code**

In `public/app.js`, remove `checkOpenSCAD`, `state.openscadAvailable`, the `$('btnStl')` (old) enable logic, and any DOM refs to the removed `stlCard`. Keep `downloadSCAD` (SCAD still supported).

- [ ] **Step 4: Verify the server starts and full suite passes**

Run:
```bash
node -e "require('./src/server.js')" # should not throw on require
node --test
```
Then `npm start` and confirm no console errors referencing removed routes/elements. Generate a card; download 3MF and STL.

- [ ] **Step 5: Verify exported files in slicers (manual)**

Open the downloaded `.3mf` in Bambu Studio: expect multiple colored objects (base / gold / white / QR). Open the `.stl` in a generic slicer: expect a single combined relief. Slice + (optionally) print; scan the QR off the print.

- [ ] **Step 6: Update README**

In `README.md`, add a "3D Relief Plaque" section: what it does, that 3MF is multi-color (Bambu) and STL is single-color fallback, both client-side; note v1 limitations (offline mode has no 3D; badges flatten to the nearest color; ~4 colors). Remove or update any OpenSCAD STL instructions that referenced the deleted routes.

- [ ] **Step 7: Final commit**

```bash
git add public/app.js src/server.js README.md
git commit -m "feat: 3MF/STL download buttons; drop OpenSCAD routes; docs"
```

---

## Implementer Checklist

- [ ] `node --test` passes (qr-matrix, relief, qr3d incl. jsQR gate + 3MF zip).
- [ ] `/api/generate` response includes a valid `qrMatrix` (odd size ≥21, base64 length = size²).
- [ ] PNG preview and existing generate/download flows are unchanged (no regression from the builder refactor).
- [ ] The 3D tab lazily builds on first open and rebuilds after each Generate.
- [ ] Sharp QR box count equals the matrix's dark-module count; rasterized QR decodes via jsQR to the original string.
- [ ] 3MF opens in Bambu Studio with one object per color; STL opens in a generic slicer.
- [ ] No-WebGL path: preview shows a notice, but 3MF/STL export still works.
- [ ] Offline (server-down) path: 3D tab shows the documented "needs server" message; no crash.
- [ ] OpenSCAD UI card and `/api/openscad-status` + `/api/download/stl` routes are removed; SCAD download still works.
- [ ] Vendored modules contain no unmapped bare imports; `three` is a singleton (one REVISION) in the browser.
