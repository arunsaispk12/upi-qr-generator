# UPI QR Generator — 3D Print + Image Export

A full-stack web app that generates branded QR codes (UPI, URL, WhatsApp, Instagram,
Google Review, WiFi) and exports them as:
- **PNG image** — for digital sharing (WhatsApp, print, display)
- **3D relief plaque** — a multi-color **3MF** (Bambu-native) or single-color **STL**,
  generated entirely in the browser and previewable in an interactive 3D viewer
- **.scad file** — parametric OpenSCAD model ready to render → STL → 3D print

---

## Project Structure

```
upi-qr-generator/
├── public/
│   ├── index.html        ← Frontend UI (incl. import map for the 3D vendor modules)
│   ├── style.css         ← Stylesheet
│   ├── app.js            ← Frontend logic (works standalone too)
│   ├── relief.js         ← Image → geometry core (k-means quantize, mask → extrude)
│   ├── qr3d.js           ← 3D plaque assembly, WebGL preview, STL/3MF export
│   └── vendor/           ← Vendored ESM: three.js + addons, d3-contour, 3MF exporter
├── src/
│   ├── server.js         ← Express API server
│   ├── upi.js            ← UPI string builder + validator
│   ├── scad-builder.js   ← OpenSCAD file generator
│   └── image-generator.js ← PNG card generator (canvas)
├── scad/
│   ├── scadqr_library.scad  ← scadqr library (MIT)
│   └── example_upi.scad     ← Example SCAD file
├── package.json
└── README.md
```

---

## Quick Start

### Option A — Full stack (recommended)

```bash
cd upi-qr-generator
npm install
npm start
# Open http://localhost:3000
```

### Option B — Static only (no Node.js)

Just open `public/index.html` directly in Chrome or Firefox.  
The app falls back to client-side mode automatically — all QR generation
and canvas rendering happens in the browser with no server needed.

### Option C — Serve static with npx

```bash
npx serve public -p 3000
```

---

## API Endpoints

### `POST /api/generate`
Returns JSON with the SCAD file content and PNG as base64.

**Request body:**
```json
{
  "upiId":          "name@upi",
  "payeeName":      "My Shop",
  "amount":         "150.00",
  "note":           "Payment",
  "brandName":      "My Brand",
  "primaryColor":   "#7c3aed",
  "qrColor":        "#1a1a2e",
  "baseLength":     90,
  "baseWidth":      90,
  "baseThickness":  2,
  "qrSize":         70,
  "qrRaise":        0.8,
  "roundedCorners": true,
  "cornerRadius":   4,
  "keyringHole":    false,
  "centreLabel":    true,
  "centreLabelText":"UPI"
}
```

**Response:**
```json
{
  "success":    true,
  "qrString":   "upi://pay?pa=...",
  "qrMatrix":   { "size": 33, "data": "<base64 of size*size 0/1 bytes>" },
  "scadFile":   "// OpenSCAD content...",
  "pngBase64":  "iVBORw0KGgo..."
}
```

`qrMatrix` carries the QR module grid so the browser can rebuild a crisp,
scannable QR directly in the 3D relief (rather than tracing it from pixels).

### `POST /api/download/scad`
Returns the `.scad` file as a download attachment.

### `POST /api/download/png`
Returns the `.png` file as a download attachment.

---

## 3D Relief Plaque (browser-side)

After generating a card, open the **3D Model** tab to see the whole branded card as
a multi-color relief plaque you can rotate and zoom, then download it print-ready.

How it works: the rendered card canvas is quantized to ~4 colors (k-means); each
color becomes an extruded relief layer (via `d3-contour`), and the QR region is
rebuilt sharp from the `qrMatrix` (white field + raised black module boxes) so it
stays scannable. Everything runs client-side with vendored `three.js`.

- **Download 3MF** — multi-color, one object per color, tested against **Bambu Studio**.
- **Download STL** — single combined mesh for any generic slicer.

A `node --test` scannability gate decodes the rebuilt QR with `jsQR` to guarantee the
geometry still resolves to the original string.

**v1 limitations:**
- No 3D in offline/standalone mode — the relief needs the server's `qrMatrix`.
- Palette is capped at ~4 colors; multi-color badges (G Pay/PhonePe/Paytm) flatten
  into the nearest layer (faithful silhouette, simplified color).
- Requires WebGL for the preview; if WebGL is unavailable, the 3MF/STL downloads
  still work (the exporters serialize geometry without rendering).

---

## OpenSCAD Printing Workflow (.scad path)

```
1. Generate QR  →  Download .scad
2. Open in OpenSCAD (openscad.org)
3. Press F6 to render  (1–3 min)
4. File → Export → Export as STL
5. Open STL in slicer (Bambu Studio / Cura / PrusaSlicer)
6. Print!
```

### Recommended print settings
| Setting | Value |
|---------|-------|
| Layer height | 0.15 mm |
| Infill | 20% |
| Supports | None needed |
| Material | PLA |

### Two-colour printing (best result)
1. Print base in **white PLA** up to `base_thickness` mm
2. Pause the printer (M600 or filament change)
3. Swap to **black PLA**
4. Continue — raised QR modules print in black

---

## Extending the Project

### Add more QR modes (WiFi, VCard, URL)

Edit `src/upi.js` and add new builder functions:

```js
function buildWiFiString({ ssid, password, security = 'WPA' }) {
  return `WIFI:T:${security};S:${ssid};P:${password};;`;
}
```

Then expose via a new `mode` param in `server.js`.

### Add logo/image overlay on QR

In `src/image-generator.js`, after drawing the QR canvas, use `ctx.drawImage(logo, ...)` to overlay a logo in the centre. Error correction level H (30%) gives enough redundancy.

### Auto-generate STL (headless OpenSCAD)

```bash
npm install node-openscad  # community wrapper
```

```js
const { render } = require('node-openscad');
const stl = await render(scadContent);
fs.writeFileSync('output.stl', stl);
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server |
| `qrcode` | Server-side QR generation + module matrix |
| `canvas` | Server-side PNG rendering (optional dependency) |
| `cors` | Cross-origin headers |
| `three` *(vendored)* | 3D geometry, WebGL preview, STL export |
| `d3-contour` *(vendored)* | Mask → contour rings for the relief layers |
| `three-3mf-exporter` *(vendored)* | Multi-color 3MF export (Bambu-tested) |
| `jsqr` *(dev)* | QR decode for the scannability test gate |
| [scadqr](https://github.com/xypwn/scadqr) | OpenSCAD QR library (MIT) |

---

## License

MIT — scadqr library by Darwin Schuppan, embedded under MIT license.
