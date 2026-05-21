# UPI QR Generator — 3D Print + Image Export

A full-stack web app that generates branded UPI payment QR codes and exports them as:
- **PNG image** — for digital sharing (WhatsApp, print, display)
- **.scad file** — parametric OpenSCAD model ready to render → STL → 3D print

---

## Project Structure

```
upi-qr-generator/
├── public/
│   ├── index.html        ← Frontend UI
│   ├── style.css         ← Stylesheet
│   └── app.js            ← Frontend logic (works standalone too)
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
  "upiString":  "upi://pay?pa=...",
  "scadFile":   "// OpenSCAD content...",
  "pngBase64":  "iVBORw0KGgo..."
}
```

### `POST /api/download/scad`
Returns the `.scad` file as a download attachment.

### `POST /api/download/png`
Returns the `.png` file as a download attachment.

---

## 3D Printing Workflow

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
| `qrcode` | Server-side QR generation |
| `canvas` | Server-side PNG rendering |
| `cors` | Cross-origin headers |
| [scadqr](https://github.com/xypwn/scadqr) | OpenSCAD QR library (MIT) |

---

## License

MIT — scadqr library by Darwin Schuppan, embedded under MIT license.
