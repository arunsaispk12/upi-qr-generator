# Card → 3D Relief Plaque — Design

**Date:** 2026-05-30
**Status:** Approved for planning
**Supersedes:** the earlier "QR plate only" 3D direction discussed in brainstorming.

## Goal

Convert the existing branded QR card (the full `buildUpiCard` / `buildServiceCard`
output — emblem logo, brand name, tagline, "SCAN & PAY", QR, UPI-ID pill,
payment-app badges, footer) into a **multi-color 3D relief plaque** that the user
can both:

- **View** interactively on the page (rotate/zoom), and
- **Download** as a print-ready file.

Reference output the 3D version must reproduce: `bhuvis_qr.png` (black background,
gold emblem + accents, white QR field, gold footer band).

## Decisions (locked during brainstorming)

| Decision | Choice |
|----------|--------|
| 3D scope | **Whole card** as a relief plaque (not just the QR plate) |
| Purpose | **Both** on-screen preview and physical 3D print |
| Engine | **three.js + image-derived relief** (not OpenSCAD / OpenSCAD-WASM) |
| Output formats | **3MF (multi-color)** primary + **STL (single-color)** fallback |
| Color handling | k-means quantize to **~4 colors**; flatten multicolor badges into nearest layer |
| Relief style | **Uniform emboss** heights per color layer (not grayscale/HueForge brightness relief) |

### Why three.js image-relief over OpenSCAD

MakerWorld's MakerLab "Parametric Model Maker" runs OpenSCAD in-browser (WASM) +
three.js preview + 3MF export. That works for parametric geometry, but **the card
is largely raster art** (the gold emblem and the GPay/PhonePe/Paytm badges are
images). OpenSCAD — native or WASM — cannot reproduce raster art. The
color-layer-relief technique MakerLab uses for *lithophanes* can, and it lets us
**reuse the existing canvas card renderer** instead of re-laying-out the whole card
in a new engine.

### Why 3MF + STL

The card is black + gold + white. 3MF is Bambu's native format and the one that
carries multi-color / multi-material info. three.js has no built-in 3MF exporter,
but the maintained `three-3mf-exporter` npm package is tested against Bambu Studio.
It supports one color per object, so multi-color = **one mesh per color**, which
maps perfectly onto our segmented layers. STL (binary, single-color) is the
universal fallback for basic slicers.

## Pipeline

```
existing card canvas (buildUpiCard / buildServiceCard)
   ├─ k-means quantize → ~4 colors (black base / gold / white / [accent])
   ├─ for each color → binary mask → contours (d3-contour) → THREE.Shape → ExtrudeGeometry
   │     • base color   = full plate at thickness T
   │     • other colors = raised +h, each a separate mesh (= one 3MF object per color)
   ├─ QR region (known rect from layout): EXCLUDED from segmentation, rebuilt sharp
   │     from qrMatrix → white field plate + black module boxes
   └─ THREE.Group → preview (WebGLRenderer + OrbitControls) + export (3MF / STL)
```

## Components & boundaries

### `src/qr-matrix.js` (new, server)
- `getQrMatrix(qrString) → { size, data }` using the existing `qrcode` lib
  (`QRCode.create(qrString, { errorCorrectionLevel: 'H' }).modules`).
- `data` serialized as base64 of the byte array (~0.5–4 KB).
- Wired into `/api/generate`, which gains a `qrMatrix` field in its JSON response.

### Card renderer refactor (`public/app.js`)
- `buildUpiCard` / `buildServiceCard` additionally return
  `{ canvas, layout }` where:
  - `canvas` — the rendered card `<canvas>` (for `getImageData`),
  - `layout` — `{ qrRect: {x,y,w,h}, paletteHints: [...] }` so the relief builder
    can exclude/replace the QR region and seed quantization.
- The existing PNG data-URL return path is preserved (pure addition).
- The 3D feature always renders the card client-side (these builders already exist
  and run in the browser for the offline fallback), giving us pixels + layout + the
  QR matrix in one place.

### `public/relief.js` (new) — image → geometry core
- `quantize(imageData, k) → { palette, labels }` — small self-written k-means
  (no dependency).
- `maskForColor(labels, colorIndex, size) → Uint8 mask`.
- `maskToGeometry(mask, { heightMM, pxToMM, simplifyTol }) → BufferGeometry`
  via `d3-contour` → rings → `THREE.Shape` (outer + holes) → `ExtrudeGeometry`.
- Pure functions, unit-testable in Node.

### `public/qr3d.js` (new, ES module)
- `build(canvas, layout, matrix, opts) → THREE.Group` — assembles base plate +
  per-color relief meshes + sharp QR (white field + merged black module boxes).
- `mountPreview(group, canvasEl)` / `disposePreview()` — WebGLRenderer +
  OrbitControls, lighting, auto-framed camera.
- `exportSTL(group) → Blob` — `STLExporter` (binary), combined geometry.
- `export3MF(group) → Blob` — `three-3mf-exporter`, one object per color.
- Exposed on `window.QR3D` so the classic-script `app.js` can call it.

### `public/vendor/` (committed, ESM)
- three.js + `OrbitControls` + `STLExporter`
- `three-3mf-exporter` (Bambu-tested)
- `d3-contour`
- (k-means written in-repo, no vendor)

### UI (`public/index.html`, `public/style.css`, `public/app.js`)
- New **"3D Model"** tab hosting a `<canvas>` viewer + an orbit hint.
- Export card gains **Download 3MF** and **Download STL** buttons (both client-side,
  always available — no server/OpenSCAD dependency).
- Remove the OpenSCAD-detection UI (`stlCard`, `checkOpenSCAD`, the
  "Direct STL via OpenSCAD" card).
- 3D is **lazy-built** on first switch to the 3D tab (and rebuilt after each
  Generate) to avoid geometry cost for PNG-only users.

## Geometry specifics

- **Working resolution:** downsample the card raster to ~350 px on the long edge.
  This yields clean low-poly contours (a few k triangles/layer), not millions of
  per-pixel voxels.
- **Physical mapping:** card long edge → a sensible default plaque size in mm
  (configurable); derive `pxToMM`.
- **Heights:** base plate `T ≈ 2 mm`; raised color layers `+0.6–1 mm`, uniform per
  layer. Color distinguishes elements; uniform heights flatten cleanly to the STL.
- **QR:** `cell = qrSize / matrix.size`; one merged box mesh for dark modules on a
  white field plate, positioned in `layout.qrRect`. Centre logo overlay tolerated
  (error-correction level H).
- **Badges / emblem:** raster art quantizes into the nearest color layer (e.g. the
  multicolor GPay badge flattens to gold/white) — faithful silhouette, simplified
  color.

## Error handling / degradation

- **No WebGL** → 3D tab shows a notice; 3MF/STL export still works (exporters
  serialize geometry without rendering).
- **No QR matrix** (server-down offline fallback) → 3D tab disabled with a message.
  Documented v1 limitation.
- **Per-layer contour/quantize failure** → skip that layer, build the rest.
- **SVG/logo or font issues** → not applicable here (we segment rendered pixels, not
  re-typeset).

## Testing & verification

- **Node unit tests** (`test/`, `three` as devDependency; existing optional `canvas`
  dep provides `getImageData`):
  - k-means deterministic on a fixture image.
  - `maskToGeometry` produces sane bounding box / area for a known mask.
  - sharp-QR box count == number of dark modules in the matrix.
  - `export3MF` output is a valid zip containing N color objects.
  - `exportSTL` output is a non-empty valid binary STL.
- **Scannability gate (must pass):** render a top-down orthographic snapshot of the
  QR layer, decode with `jsQR`, assert it equals the original `qrString`.
- **Manual:** rotate in the 3D tab; open the **3MF in Bambu Studio** and the **STL in
  a generic slicer**; confirm colors and that the QR scans off a print.

## Build sequence

1. `src/qr-matrix.js` + wire `qrMatrix` into `/api/generate` (test).
2. Refactor `buildUpiCard` / `buildServiceCard` to also return `{ canvas, layout }`.
3. Vendor three.js + addons + `three-3mf-exporter` + `d3-contour`.
4. `relief.js`: k-means quantize + mask→geometry, with Node tests.
5. `qr3d.js`: assemble group + sharp QR; scannability test.
6. Viewer (WebGL + OrbitControls) in new "3D Model" tab.
7. 3MF + STL export buttons + tests.
8. UI wiring; remove OpenSCAD routes/UI; update README + docs.

## Scope boundaries (YAGNI)

- Uniform emboss heights, **not** grayscale/HueForge brightness relief.
- Palette capped at ~4 colors; multicolor badges flattened to nearest layer.
- No offline (server-down) 3D in v1.
- The legacy `.scad` download and `/api/download/stl` + `/api/openscad-status` routes
  are left orphaned/removed at the UI level; not worth deep refactoring beyond
  dropping their UI and the status check.

## Future follow-ups (out of scope)

- Grayscale/HueForge-style height-per-brightness relief option.
- Full-color badge reproduction (more material layers).
- Offline client-side QR matrix so 3D works without the server.
- 3MF multi-plate output.
