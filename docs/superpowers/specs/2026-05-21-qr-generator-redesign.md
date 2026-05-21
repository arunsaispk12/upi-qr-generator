# QR Generator Redesign — Design Spec
**Date:** 2026-05-21  
**Status:** Approved

---

## 1. Goal

Transform the existing UPI-only QR generator into a universal branded QR generator that supports 6 QR types (URL, WhatsApp, Instagram, Google Review, UPI Payment, WiFi), each with smart form fields and service brand defaults. Every generation produces two outputs: a **branded PNG card** and a **parametric OpenSCAD 3D file** (or ZIP when SVG logo is used).

---

## 2. QR Types & Smart Fields

Each type auto-fills the branding section with service defaults (icon + color) that the user can override.

| Type | Smart Fields | Encoded String Format | Default Color | Default Logo |
|------|-------------|----------------------|---------------|--------------|
| **URL** | URL input | Raw URL | `#1a1a2e` | Globe emoji / no logo |
| **WhatsApp** | Phone (with country code), Pre-filled message (optional) | `https://wa.me/{phone}?text={msg}` | `#25D366` | WA icon |
| **Instagram** | Username | `https://instagram.com/{username}` | `#E1306C` | IG icon |
| **Google Review** | Place ID (text input + instructions link) | `https://search.google.com/local/writereview?placeid={id}` | `#4285F4` | Google icon |
| **UPI Payment** | UPI ID, Payee Name, Amount (optional), Note (optional) | `upi://pay?pa=...&pn=...&cu=INR` | `#7c3aed` | UPI icon |
| **WiFi** | SSID, Password, Security (WPA/WPA2/WEP/None), Hidden toggle | `WIFI:T:WPA;S:{ssid};P:{pass};H:false;;` | `#0ea5e9` | WiFi icon |

Service icons are simple custom-designed SVG strings embedded in `app.js` — no external requests, no use of trademarked brand logos.

### UI — Type Selector Grid
A 2×3 grid of icon cards sits at the top of the sidebar, above all form fields. Each card shows the service icon + label. Clicking a card: switches the form fields below, applies service color + icon to the branding section (if user hasn't already set a custom logo/color), and clears the previous QR type's fields. Active card is highlighted with the service's brand color border.

---

## 3. Logo Pipeline

### Upload
- File input accepts `.png`, `.jpg`, `.svg` (max 2MB, enforced client-side)
- Frontend reads as base64 data URL, detects type from MIME prefix
- Sent with generate request as `logoDataUrl` field

### PNG/JPG Logo
- Drawn into header circle (replaces letter-avatar), clipped to circle via canvas
- Drawn centred in QR middle (replaces text badge when logo is present)
- 3D file: plain blank white raised rectangle at QR centre — no logo

### SVG Logo
- Rendered in PNG card via `canvas.loadImage()` (canvas package supports SVG)
- 3D download becomes a **ZIP** (`plate.scad` + `logo.svg`)
- `.scad` references logo: `linear_extrude(h=0.6) import("logo.svg");`
- UI note: "SVG download is a .zip — extract both files before opening in OpenSCAD"

### Canvas not installed (fallback)
If `canvas` is not installed and a logo is uploaded: the server falls back to plain QR PNG (no branded card). The logo is still included in the `.scad`/ZIP if SVG. The API response includes `{ canvasMissing: true }` so the frontend can show: "Install canvas for branded card output."

### No Logo
- Letter-avatar (first char of brand name) shown in header
- Text badge (e.g. "UPI", "WiFi") shown in QR centre if `centreLabel` is on
- 3D file: text badge as before

---

## 4. PNG Card Design

Card dimensions and layout are unchanged. Improvements:

- **Drop shadow** on the card via canvas `shadowBlur`
- **Badge dimensions** now respect `badgeWidth` / `badgeHeight` form params (currently hardcoded at 70×22)
- **Header subtitle** adapts per type: "Scan to Pay · UPI", "Scan to Connect · WhatsApp", "Scan to Follow · Instagram", etc.
- **Logo rendering**: SVG and PNG logos both clipped to circle in header; scaled proportionally to fit QR centre badge area

---

## 5. 3D File (OpenSCAD)

Behaviour unchanged for non-SVG logos:
- Self-contained `.scad` with embedded scadqr library
- Blank white raised rectangle replaces text/logo badge at QR centre

For SVG logo:
- ZIP download: `{name}_qr.zip` containing `plate.scad` + `logo.svg`
- SCAD references logo at centre badge position:
  ```openscad
  translate([badge_x, badge_y, base_thickness + qr_block_height])
    linear_extrude(height=0.6)
      import("logo.svg");
  ```
- `archiver` npm package used to build ZIP on server

---

## 6. History Panel

- On each successful generate, save config to `localStorage` key `qrgen_history`
- Keep last 5 entries: `{ timestamp, label, mode, formData, pngBase64Thumb }` — thumbnail is the PNG card downscaled to 80×80px on the client before storing, keeping each entry under ~15KB
- `label` = payeeName (UPI), ssid (WiFi), username (Instagram), etc.
- Rendered below export panel as small cards: icon + label + type badge + time ago
- Clicking a card: restores all form values, switches mode, auto-generates
- "Clear history" link at bottom of section

---

## 7. STL Export (Optional / Progressive Enhancement)

- `GET /api/openscad-status` — runs `openscad --version`, returns `{ available: bool, version: string }`
- Frontend checks on load; shows "Export STL" button only if `available: true`
- `POST /api/download/stl` — writes SCAD to OS temp dir, runs OpenSCAD, streams `.stl` back
- On failure (timeout, render error) returns 500 with error message
- Timeout: 120s

---

## 8. File Plan

### New files
| File | Purpose |
|------|---------|
| `src/wifi.js` | `buildWiFiString({ ssid, password, security, hidden })` |
| `src/qr-types.js` | Type definitions: fields, URL builders, default colors, SVG icon strings |

### Modified files
| File | Changes |
|------|---------|
| `src/server.js` | Mode routing, logo handling, ZIP response for SVG, `/api/openscad-status`, `/api/download/stl` |
| `src/image-generator.js` | Logo in header + QR centre, fix badge dimensions, add drop shadow, subtitle per type |
| `src/scad-builder.js` | Accept `logoSvgContent`, emit ZIP via `archiver` when SVG present |
| `public/index.html` | Type selector grid, logo upload + preview, history section |
| `public/app.js` | Type switching, logo upload flow, history, standalone warning, service defaults |
| `public/style.css` | Type grid, logo upload widget, history cards |
| `package.json` | Move `canvas` to `optionalDependencies`, add `archiver` |

---

## 9. API Changes

### POST /api/generate (extended)
```json
{
  "mode": "url | whatsapp | instagram | google_review | upi | wifi",
  "logoDataUrl": "data:image/png;base64,... (optional)",
  "logoType": "png | svg (optional)",
  
  // URL
  "url": "https://...",

  // WhatsApp
  "waPhone": "919876543210",
  "waMessage": "Hello!",

  // Instagram
  "igUsername": "myshop",

  // Google Review
  "grPlaceId": "ChIJ...",

  // UPI (existing fields unchanged)
  "upiId": "name@upi",
  "payeeName": "My Shop",
  "amount": "",
  "note": "",

  // WiFi
  "wifiSsid": "MyNetwork",
  "wifiPassword": "secret",
  "wifiSecurity": "WPA",
  "wifiHidden": false,

  // Branding (all modes)
  "brandName": "My Brand",
  "primaryColor": "#25D366",
  "qrColor": "#1a1a2e",

  // Plate options (unchanged from original spec)
  "baseLength": 90,
  "baseWidth": 90,
  "baseThickness": 2,
  "qrSize": 70,
  "qrRaise": 0.8,
  "roundedCorners": false,
  "cornerRadius": 4,
  "keyringHole": false,
  "holeDiameter": 5,
  "tabDiameter": 12,
  "keyringPosition": 0,
  "centreLabel": true,
  "centreLabelText": "UPI",
  "badgeWidth": 30,
  "badgeHeight": 8
}
```

Response: `{ success, qrString, scadFile, pngBase64, isZip }`  
When `isZip: true`, `scadFile` is a base64-encoded ZIP.

### GET /api/openscad-status
Response: `{ available: bool, version: string }`

### POST /api/download/stl
Same body as `/api/generate`. Returns `.stl` binary stream or 500.

---

## 10. Constraints & Out of Scope

- No framework migration — vanilla JS + Express throughout
- No database — localStorage only for history
- No logo CDN or external fetch — service icons are embedded SVG strings
- vCard, Email, SMS, Facebook, LinkedIn, YouTube — deferred to future iteration
- QR code scanning / validation — not in scope
- Mobile app — not in scope
