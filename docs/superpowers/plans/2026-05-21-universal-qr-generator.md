# Universal QR Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the UPI-only QR generator into a universal branded QR generator supporting 6 QR types (URL, WhatsApp, Instagram, Google Review, UPI, WiFi) with logo upload, producing a branded PNG card and OpenSCAD 3D file.

**Architecture:** A multi-mode Express API routes each QR type through a shared pipeline — type-specific string builder then PNG card renderer then SCAD builder. The frontend has a type-selector grid that switches form fields and applies service brand defaults. Logo upload feeds into both the PNG card and (for SVG) the 3D file. History is localStorage-only.

**Tech Stack:** Node.js, Express, `qrcode`, `canvas` (optional), `archiver`, Vanilla JS, CSS custom properties

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/qr-types.js` | **Create** | Type definitions, URL builders, validators (server-side) |
| `src/wifi.js` | **Create** | WiFi string builder |
| `src/server.js` | **Rewrite** | Mode routing, logo handling, all endpoints |
| `src/image-generator.js` | **Rewrite** | Logo in card, badge dims fix, drop shadow, subtitle per type |
| `src/scad-builder.js` | **Rewrite** | Blank patch for PNG logo, ZIP for SVG logo |
| `public/index.html` | **Rewrite** | Type grid, all 6 form field sets, logo upload, history section |
| `public/app.js` | **Rewrite** | Mode switching, logo flow, history, service defaults, standalone |
| `public/style.css` | **Extend** | Type grid, logo upload widget, history cards |
| `package.json` | **Modify** | canvas to optionalDependencies, add archiver |

---

## Task 1: Fix package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace package.json**

```json
{
  "name": "upi-qr-generator",
  "version": "2.0.0",
  "description": "Universal Branded QR Code Generator — PNG card + OpenSCAD 3D file",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "serve": "npx serve public -p 3000"
  },
  "dependencies": {
    "archiver": "^6.0.1",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "qrcode": "^1.5.3"
  },
  "optionalDependencies": {
    "canvas": "^2.11.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Install**

```bash
cd D:\Claude-Co-Work\upi-qr-generator
npm install
```

Expected: installs cleanly. canvas may warn — that is OK, it is optional.

- [ ] **Step 3: Verify core packages**

```bash
node -e "require('archiver'); console.log('archiver ok')"
node -e "require('qrcode');   console.log('qrcode ok')"
```

Expected: both print `ok`.

- [ ] **Step 4: Commit**

```bash
git init
git add package.json package-lock.json
git commit -m "chore: move canvas to optional, add archiver"
```

---

## Task 2: Create src/wifi.js

**Files:**
- Create: `src/wifi.js`

- [ ] **Step 1: Create the file**

```js
function buildWiFiString({ ssid, password, security = 'WPA', hidden = false }) {
  if (!ssid) throw new Error('SSID is required');
  const esc = s => (s || '').replace(/([\\;,"':])/, '\\$1');
  return `WIFI:T:${security};S:${esc(ssid)};P:${esc(password)};H:${hidden};;`;
}

module.exports = { buildWiFiString };
```

- [ ] **Step 2: Smoke-test**

```bash
node -e "
const { buildWiFiString } = require('./src/wifi');
console.log(buildWiFiString({ ssid: 'MyNet', password: 'secret123', security: 'WPA' }));
console.log(buildWiFiString({ ssid: 'Open', password: '', security: 'nopass' }));
"
```

Expected:
```
WIFI:T:WPA;S:MyNet;P:secret123;H:false;;
WIFI:T:nopass;S:Open;P:;H:false;;
```

- [ ] **Step 3: Commit**

```bash
git add src/wifi.js
git commit -m "feat: WiFi QR string builder"
```

---

## Task 3: Create src/qr-types.js

**Files:**
- Create: `src/qr-types.js`

- [ ] **Step 1: Create the file**

```js
const { buildUPIString, validateUPIId } = require('./upi');
const { buildWiFiString }               = require('./wifi');

const QR_TYPES = {
  url: {
    label: 'Website',
    defaultColor: '#1a73e8',
    subtitle: 'Scan to Visit',
    centreLabelText: 'URL',
    buildQrString({ url }) {
      if (!url || !url.trim()) throw new Error('URL is required');
      return url.trim();
    },
    validate({ url }) {
      if (!url || !url.trim()) return 'URL is required';
      try { new URL(url.trim()); return null; }
      catch { return 'Invalid URL — include https://'; }
    },
  },

  whatsapp: {
    label: 'WhatsApp',
    defaultColor: '#25D366',
    subtitle: 'Scan to Chat',
    centreLabelText: 'WA',
    buildQrString({ waPhone, waMessage }) {
      if (!waPhone) throw new Error('Phone number is required');
      const phone = waPhone.replace(/\D/g, '');
      let u = `https://wa.me/${phone}`;
      if (waMessage && waMessage.trim()) u += `?text=${encodeURIComponent(waMessage.trim())}`;
      return u;
    },
    validate({ waPhone }) {
      if (!waPhone) return 'Phone number is required';
      const d = waPhone.replace(/\D/g, '');
      if (d.length < 7 || d.length > 15) return 'Phone must be 7-15 digits (include country code)';
      return null;
    },
  },

  instagram: {
    label: 'Instagram',
    defaultColor: '#E1306C',
    subtitle: 'Scan to Follow',
    centreLabelText: 'IG',
    buildQrString({ igUsername }) {
      if (!igUsername) throw new Error('Username is required');
      return `https://instagram.com/${igUsername.replace(/^@/, '').trim()}`;
    },
    validate({ igUsername }) {
      if (!igUsername) return 'Instagram username is required';
      return null;
    },
  },

  google_review: {
    label: 'Google Review',
    defaultColor: '#4285F4',
    subtitle: 'Leave a Review',
    centreLabelText: 'G*',
    buildQrString({ grPlaceId }) {
      if (!grPlaceId) throw new Error('Place ID is required');
      return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(grPlaceId.trim())}`;
    },
    validate({ grPlaceId }) {
      if (!grPlaceId) return 'Google Place ID is required';
      return null;
    },
  },

  upi: {
    label: 'UPI Payment',
    defaultColor: '#7c3aed',
    subtitle: 'Scan to Pay',
    centreLabelText: 'UPI',
    buildQrString({ upiId, payeeName, amount, note }) {
      return buildUPIString({ upiId, payeeName, amount, note });
    },
    validate({ upiId, payeeName }) {
      if (!upiId)     return 'UPI ID is required';
      if (!payeeName) return 'Payee name is required';
      if (!validateUPIId(upiId)) return 'Invalid UPI ID — use format name@provider';
      return null;
    },
  },

  wifi: {
    label: 'WiFi',
    defaultColor: '#0ea5e9',
    subtitle: 'Scan to Connect',
    centreLabelText: 'WiFi',
    buildQrString({ wifiSsid, wifiPassword, wifiSecurity, wifiHidden }) {
      return buildWiFiString({
        ssid: wifiSsid, password: wifiPassword,
        security: wifiSecurity || 'WPA', hidden: !!wifiHidden,
      });
    },
    validate({ wifiSsid }) {
      if (!wifiSsid) return 'Network name (SSID) is required';
      return null;
    },
  },
};

module.exports = { QR_TYPES };
```

- [ ] **Step 2: Smoke-test all builders**

```bash
node -e "
const { QR_TYPES } = require('./src/qr-types');
console.log(QR_TYPES.url.buildQrString({ url: 'https://example.com' }));
console.log(QR_TYPES.whatsapp.buildQrString({ waPhone: '919876543210', waMessage: 'Hi' }));
console.log(QR_TYPES.instagram.buildQrString({ igUsername: '@myshop' }));
console.log(QR_TYPES.google_review.buildQrString({ grPlaceId: 'ChIJabc' }));
console.log(QR_TYPES.upi.buildQrString({ upiId: 'test@upi', payeeName: 'Test' }));
console.log(QR_TYPES.wifi.buildQrString({ wifiSsid: 'Home', wifiPassword: 'pass', wifiSecurity: 'WPA' }));
"
```

Expected (one line each):
```
https://example.com
https://wa.me/919876543210?text=Hi
https://instagram.com/myshop
https://search.google.com/local/writereview?placeid=ChIJabc
upi://pay?pa=test%40upi&pn=Test&cu=INR
WIFI:T:WPA;S:Home;P:pass;H:false;;
```

- [ ] **Step 3: Commit**

```bash
git add src/qr-types.js
git commit -m "feat: multi-mode QR type definitions"
```

---

## Task 4: Rewrite src/server.js

**Files:**
- Modify: `src/server.js`

- [ ] **Step 1: Replace src/server.js**

```js
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const os       = require('os');
const fs       = require('fs');
const { execFile }       = require('child_process');
const { QR_TYPES }       = require('./qr-types');
const { buildSCAD }      = require('./scad-builder');
const { generateQRCard } = require('./image-generator');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../public')));

function extractPlateOpts(body) {
  const {
    baseLength = 90, baseWidth = 90, baseThickness = 2,
    qrSize = 70, qrRaise = 0.8,
    roundedCorners = false, cornerRadius = 4,
    keyringHole = false, holeDiameter = 5, tabDiameter = 12, keyringPosition = 0,
    centreLabel = true, centreLabelText, badgeWidth = 30, badgeHeight = 8,
  } = body;
  return {
    baseLength, baseWidth, baseThickness, qrSize, qrRaise,
    roundedCorners, cornerRadius, keyringHole, holeDiameter,
    tabDiameter, keyringPosition, centreLabel,
    centreLabelText: centreLabelText || 'QR',
    badgeWidth, badgeHeight,
  };
}

function extractBrandOpts(body) {
  return {
    brandName:    body.brandName    || '',
    primaryColor: body.primaryColor || '#1a1a2e',
    qrColor:      body.qrColor      || '#1a1a2e',
    logoDataUrl:  body.logoDataUrl  || null,
    logoType:     body.logoType     || null,
  };
}

function getSvgContent(logoDataUrl) {
  if (!logoDataUrl) return null;
  return Buffer.from(
    logoDataUrl.replace(/^data:[^;]+;base64,/, ''), 'base64'
  ).toString('utf8');
}

app.post('/api/generate', async (req, res) => {
  try {
    const { mode = 'url' } = req.body;
    const typeDef = QR_TYPES[mode];
    if (!typeDef) return res.status(400).json({ error: 'Unknown mode: ' + mode });

    const validationError = typeDef.validate(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const qrString  = typeDef.buildQrString(req.body);
    const brandOpts = extractBrandOpts(req.body);
    const plateOpts = extractPlateOpts(req.body);

    const centreText = brandOpts.logoDataUrl
      ? ''
      : (plateOpts.centreLabel ? (plateOpts.centreLabelText || typeDef.centreLabelText) : '');

    const scadResult = await buildSCAD({
      qrString,
      payeeName:      req.body.payeeName || brandOpts.brandName || mode,
      logoType:       brandOpts.logoType,
      logoSvgContent: brandOpts.logoType === 'svg' ? getSvgContent(brandOpts.logoDataUrl) : null,
      ...plateOpts,
    });

    const pngResult = await generateQRCard({
      qrString,
      subtitle:     typeDef.subtitle,
      brandName:    brandOpts.brandName || req.body.payeeName || req.body.igUsername || req.body.wifiSsid || mode,
      primaryColor: brandOpts.primaryColor || typeDef.defaultColor,
      qrColor:      brandOpts.qrColor,
      logoDataUrl:  brandOpts.logoDataUrl,
      centreText,
      badgeWidth:   plateOpts.badgeWidth,
      badgeHeight:  plateOpts.badgeHeight,
    });

    res.json({
      success:       true,
      qrString,
      scadFile:      scadResult.isZip
        ? scadResult.content.toString('base64')
        : scadResult.content,
      isZip:         scadResult.isZip,
      filename:      scadResult.filename,
      pngBase64:     pngResult.buffer.toString('base64'),
      canvasMissing: pngResult.canvasMissing || false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/download/scad', async (req, res) => {
  try {
    const { mode = 'url' } = req.body;
    const typeDef = QR_TYPES[mode];
    if (!typeDef) return res.status(400).json({ error: 'Unknown mode: ' + mode });

    const qrString  = typeDef.buildQrString(req.body);
    const plateOpts = extractPlateOpts(req.body);
    const brandOpts = extractBrandOpts(req.body);

    const scadResult = await buildSCAD({
      qrString,
      payeeName:      req.body.payeeName || brandOpts.brandName || mode,
      logoType:       brandOpts.logoType,
      logoSvgContent: brandOpts.logoType === 'svg' ? getSvgContent(brandOpts.logoDataUrl) : null,
      ...plateOpts,
    });

    res.setHeader('Content-Disposition', `attachment; filename="${scadResult.filename}"`);
    res.setHeader('Content-Type', scadResult.isZip ? 'application/zip' : 'text/plain');
    res.send(scadResult.content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/download/png', async (req, res) => {
  try {
    const { mode = 'url' } = req.body;
    const typeDef = QR_TYPES[mode];
    if (!typeDef) return res.status(400).json({ error: 'Unknown mode: ' + mode });

    const qrString  = typeDef.buildQrString(req.body);
    const brandOpts = extractBrandOpts(req.body);
    const plateOpts = extractPlateOpts(req.body);

    const centreText = brandOpts.logoDataUrl
      ? ''
      : (plateOpts.centreLabel ? (plateOpts.centreLabelText || typeDef.centreLabelText) : '');

    const pngResult = await generateQRCard({
      qrString,
      subtitle:     typeDef.subtitle,
      brandName:    brandOpts.brandName || mode,
      primaryColor: brandOpts.primaryColor || typeDef.defaultColor,
      qrColor:      brandOpts.qrColor,
      logoDataUrl:  brandOpts.logoDataUrl,
      centreText,
      badgeWidth:   plateOpts.badgeWidth,
      badgeHeight:  plateOpts.badgeHeight,
    });

    const safeName = (req.body.payeeName || brandOpts.brandName || mode)
      .replace(/\s+/g, '_').toLowerCase();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_qr.png"`);
    res.send(pngResult.buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/openscad-status', (req, res) => {
  execFile('openscad', ['--version'], { timeout: 5000 }, (err, stdout, stderr) => {
    if (err) return res.json({ available: false, version: '' });
    res.json({ available: true, version: (stdout + stderr).trim().split('\n')[0] });
  });
});

app.post('/api/download/stl', async (req, res) => {
  try {
    const { mode = 'url' } = req.body;
    const typeDef = QR_TYPES[mode];
    if (!typeDef) return res.status(400).json({ error: 'Unknown mode: ' + mode });

    const qrString  = typeDef.buildQrString(req.body);
    const plateOpts = extractPlateOpts(req.body);
    const brandOpts = extractBrandOpts(req.body);

    const scadResult = await buildSCAD({
      qrString,
      payeeName:      req.body.payeeName || brandOpts.brandName || mode,
      logoType:       brandOpts.logoType,
      logoSvgContent: brandOpts.logoType === 'svg' ? getSvgContent(brandOpts.logoDataUrl) : null,
      ...plateOpts,
    });

    if (scadResult.isZip) {
      return res.status(400).json({ error: 'STL export with SVG logo requires manual OpenSCAD render' });
    }

    const stamp    = Date.now();
    const scadPath = path.join(os.tmpdir(), `qrgen_${stamp}.scad`);
    const stlPath  = path.join(os.tmpdir(), `qrgen_${stamp}.stl`);
    fs.writeFileSync(scadPath, scadResult.content);

    execFile('openscad',
      ['--export-format', 'binstl', '-o', stlPath, scadPath],
      { timeout: 120000 },
      (err) => {
        try { fs.unlinkSync(scadPath); } catch {}
        if (err) {
          try { fs.unlinkSync(stlPath); } catch {}
          return res.status(500).json({ error: 'OpenSCAD render failed: ' + err.message });
        }
        const safeName = (req.body.payeeName || brandOpts.brandName || mode)
          .replace(/\s+/g, '_').toLowerCase();
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_qr.stl"`);
        const stream = fs.createReadStream(stlPath);
        stream.pipe(res);
        stream.on('end', () => { try { fs.unlinkSync(stlPath); } catch {} });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Universal QR Generator at http://localhost:${PORT}\n`);
});

module.exports = app;
```

- [ ] **Step 2: Verify server starts**

```bash
npm start
```

Expected: `Universal QR Generator at http://localhost:3000`

- [ ] **Step 3: Test all 6 modes**

```bash
node -e "
const http = require('http');
const tests = [
  { mode:'url',          url:'https://example.com', brandName:'Test' },
  { mode:'whatsapp',     waPhone:'919876543210',     brandName:'Test' },
  { mode:'instagram',    igUsername:'myshop',        brandName:'Test' },
  { mode:'google_review',grPlaceId:'ChIJabc',        brandName:'Test' },
  { mode:'upi',          upiId:'test@upi',           payeeName:'Shop' },
  { mode:'wifi',         wifiSsid:'Home',            wifiPassword:'pass', brandName:'Home' },
];
tests.forEach(body => {
  const data = JSON.stringify(body);
  const req  = http.request({
    host:'localhost', port:3000, path:'/api/generate', method:'POST',
    headers:{ 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(data) }
  }, res => {
    let s = ''; res.on('data', c => s += c);
    res.on('end', () => {
      const d = JSON.parse(s);
      console.log(body.mode, d.success ? 'OK' : 'FAIL: ' + d.error);
    });
  });
  req.write(data); req.end();
});
"
```

Expected: 6 lines, each ending with `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/server.js
git commit -m "feat: 6-mode server routing, logo handling, STL endpoint"
```

---

## Task 5: Rewrite src/image-generator.js

**Files:**
- Modify: `src/image-generator.js`

- [ ] **Step 1: Replace src/image-generator.js**

```js
const QRCode = require('qrcode');

async function generateQRCard(opts) {
  const {
    qrString,
    brandName    = 'Brand',
    subtitle     = 'Scan QR Code',
    primaryColor = '#1a1a2e',
    qrColor      = '#1a1a2e',
    logoDataUrl  = null,
    centreText   = '',
    badgeWidth   = 30,
    badgeHeight  = 8,
  } = opts;

  const qrDataURL = await QRCode.toDataURL(qrString, {
    errorCorrectionLevel: 'H',
    width: 400, margin: 1,
    color: { dark: qrColor, light: '#ffffff' },
  });

  try {
    const { createCanvas, loadImage } = require('canvas');
    const buffer = await buildBrandedCard({
      createCanvas, loadImage,
      qrDataURL, brandName, subtitle, primaryColor,
      logoDataUrl, centreText, badgeWidth, badgeHeight,
    });
    return { buffer, canvasMissing: false };
  } catch {
    const base64 = qrDataURL.replace(/^data:image\/png;base64,/, '');
    return { buffer: Buffer.from(base64, 'base64'), canvasMissing: true };
  }
}

async function buildBrandedCard({
  createCanvas, loadImage,
  qrDataURL, brandName, subtitle, primaryColor,
  logoDataUrl, centreText, badgeWidth, badgeHeight,
}) {
  const QS = 320, W = 420, HH = 72, SC = 2;
  const H  = HH + QS + 110;

  const canvas = createCanvas(W * SC, H * SC);
  const ctx    = canvas.getContext('2d');
  ctx.scale(SC, SC);

  const onColor = luminance(primaryColor) > 150 ? '#1a1a2e' : '#ffffff';

  // Drop shadow behind card
  ctx.shadowColor   = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur    = 24;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 0, 0, W, H, 16);
  ctx.fill();

  // Turn off shadow for everything inside
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // Coloured header
  ctx.fillStyle = primaryColor;
  roundRectTop(ctx, 0, 0, W, HH, 16);
  ctx.fill();

  // Logo or letter-avatar in header
  const AV = 40, ax = 16, ay = (HH - AV) / 2;
  if (logoDataUrl) {
    try {
      const logoImg = await loadImage(logoDataUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + AV/2, ay + AV/2, AV/2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, ax, ay, AV, AV);
      ctx.restore();
    } catch {
      drawLetterAvatar(ctx, brandName, ax, ay, AV, onColor);
    }
  } else {
    drawLetterAvatar(ctx, brandName, ax, ay, AV, onColor);
  }

  // Brand name + subtitle
  const bx = ax + AV + 12;
  ctx.fillStyle    = onColor;
  ctx.font         = 'bold 15px sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(brandName, bx, 18);
  ctx.fillStyle = onColor + 'bb';
  ctx.font      = '11px sans-serif';
  ctx.fillText(subtitle, bx, 38);

  // QR image
  const qrImg = await loadImage(qrDataURL);
  const qx = (W - QS) / 2, qy = HH + 14;
  ctx.fillStyle = '#f0f0f4';
  roundRect(ctx, qx - 6, qy - 6, QS + 12, QS + 12, 8);
  ctx.fill();
  ctx.drawImage(qrImg, qx, qy, QS, QS);

  // Centre overlay: logo thumbnail or text badge
  // badgeWidth/badgeHeight are in mm (plate units); scale to pixel space proportionally
  const bwPx = badgeWidth  * (QS / 90);
  const bhPx = badgeHeight * (QS / 90);
  const lbx  = qx + (QS - bwPx) / 2;
  const lby  = qy + (QS - bhPx) / 2;

  if (logoDataUrl) {
    try {
      const logoImg = await loadImage(logoDataUrl);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, lbx - 2, lby - 2, bwPx + 4, bhPx + 4, 4);
      ctx.fill();
      roundRect(ctx, lbx, lby, bwPx, bhPx, 4);
      ctx.clip();
      ctx.drawImage(logoImg, lbx, lby, bwPx, bhPx);
      ctx.restore();
    } catch { /* logo render failed silently */ }
  } else if (centreText && centreText.trim()) {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, lbx, lby, bwPx, bhPx, 4);
    ctx.fill();
    ctx.fillStyle    = primaryColor;
    ctx.font         = `bold ${Math.max(8, bhPx * 0.55)}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(centreText.toUpperCase(), qx + QS/2, qy + QS/2);
  }

  // Footer info
  const iy = qy + QS + 16;
  ctx.fillStyle    = '#1a1a2e';
  ctx.font         = 'bold 16px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(brandName, W/2, iy);

  ctx.fillStyle    = '#cccccc';
  ctx.font         = '9px sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Powered by QR Generator', W/2, H - 8);

  return canvas.toBuffer('image/png');
}

function drawLetterAvatar(ctx, name, ax, ay, AV, onColor) {
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.arc(ax + AV/2, ay + AV/2, AV/2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle    = onColor;
  ctx.font         = 'bold 18px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((name || '?').charAt(0).toUpperCase(), ax + AV/2, ay + AV/2);
}

function luminance(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return 0.299*r + 0.587*g + 0.114*b;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function roundRectTop(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h);
  ctx.lineTo(x, y+h);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

module.exports = { generateQRCard };
```

- [ ] **Step 2: Test PNG generation**

```bash
node -e "
const { generateQRCard } = require('./src/image-generator');
generateQRCard({
  qrString: 'https://example.com',
  brandName: 'Test Brand',
  subtitle: 'Scan to Visit',
  primaryColor: '#1a73e8',
  badgeWidth: 30, badgeHeight: 8,
}).then(r => {
  require('fs').writeFileSync('test_card.png', r.buffer);
  console.log('canvasMissing:', r.canvasMissing, '  size:', r.buffer.length, 'bytes');
  require('fs').unlinkSync('test_card.png');
});
"
```

Expected: `canvasMissing: false  size: <large>` if canvas installed, else `canvasMissing: true`.

- [ ] **Step 3: Commit**

```bash
git add src/image-generator.js
git commit -m "feat: PNG card with logo support, drop shadow, correct badge dimensions"
```

---

## Task 6: Rewrite src/scad-builder.js

**Files:**
- Modify: `src/scad-builder.js`

- [ ] **Step 1: Replace src/scad-builder.js**

```js
const fs       = require('fs');
const path     = require('path');
const archiver = require('archiver');
const { Writable } = require('stream');

function buildSCADString(opts) {
  const {
    qrString,
    payeeName       = 'QR',
    baseLength      = 90, baseWidth = 90, baseThickness = 2,
    qrSize          = 70, qrRaise   = 0.8,
    roundedCorners  = false, cornerRadius = 4,
    keyringHole     = false, holeDiameter = 5, tabDiameter = 12, keyringPosition = 0,
    centreLabel     = true, centreLabelText = 'QR', badgeWidth = 30, badgeHeight = 8,
    hasSvgLogo      = false,
  } = opts;

  const textSize = Math.round(badgeHeight * 0.55 * 10) / 10;
  const now      = new Date().toISOString().slice(0, 10);

  const scadqrLib = fs.readFileSync(
    path.join(__dirname, '../scad/scadqr_library.scad'), 'utf8'
  );

  const centreBlock = hasSvgLogo
    ? `
    if (show_centre_label) {
        badge_x = qr_x + (qr_size - centre_badge_width) / 2;
        badge_y = qr_y + (qr_size - centre_badge_height) / 2;
        color(base_color)
            translate([badge_x, badge_y, base_thickness + qr_block_height])
                rounded_plate(centre_badge_width, centre_badge_height,
                    centre_badge_thickness,
                    min(2, centre_badge_width/2, centre_badge_height/2));
        color(label_color)
            translate([qr_x + qr_size/2, qr_y + qr_size/2,
                       base_thickness + qr_block_height + centre_badge_thickness])
                linear_extrude(height=centre_text_height)
                    import("logo.svg");
    }`
    : `
    if (show_centre_label && centre_label_text != "") {
        badge_x = qr_x + (qr_size - centre_badge_width) / 2;
        badge_y = qr_y + (qr_size - centre_badge_height) / 2;
        lx = qr_x + qr_size / 2;
        ly = qr_y + qr_size / 2;
        lz = base_thickness + qr_block_height + centre_badge_thickness;
        color(base_color)
            translate([badge_x, badge_y, base_thickness + qr_block_height])
                rounded_plate(centre_badge_width, centre_badge_height,
                    centre_badge_thickness,
                    min(2, centre_badge_width/2, centre_badge_height/2));
        color(label_color)
            translate([lx, ly, lz])
                linear_extrude(height=centre_text_height)
                    text(centre_label_text, size=centre_text_size,
                         halign="center", valign="center",
                         font="Liberation Sans:style=Bold");
    }`;

  return `// ============================================================
// Universal QR Code — Parametric 3D Print Model
// Generated: ${now}  |  Label: ${payeeName}
// Open in OpenSCAD > F6 > File > Export > STL
// ============================================================

qr_string            = "${qrString}";
base_length          = ${baseLength};
base_width           = ${baseWidth};
base_thickness       = ${baseThickness};
qr_size              = ${qrSize};
qr_block_height      = ${qrRaise};
apply_round_corner   = ${roundedCorners};
round_corner_radius  = ${cornerRadius};
add_keyring_hole     = ${keyringHole};
keyring_hole_diameter= ${holeDiameter};
keyring_tab_diameter = ${tabDiameter};
keyring_position     = ${keyringPosition};
show_centre_label    = ${centreLabel};
centre_label_text    = "${centreLabelText}";
centre_badge_width   = ${badgeWidth};
centre_badge_height  = ${badgeHeight};
centre_badge_thickness = 0.4;
centre_text_height   = 0.6;
centre_text_size     = ${textSize};
base_color  = [1, 1, 1];
qr_color    = [0, 0, 0];
label_color = [0, 0, 0];

module rounded_rect_2d(l,w,r){if(r<=0){square([l,w]);}else{hull(){translate([r,r])circle(r=r,$fn=64);translate([l-r,r])circle(r=r,$fn=64);translate([l-r,w-r])circle(r=r,$fn=64);translate([r,w-r])circle(r=r,$fn=64);}}}
module rounded_plate(l,w,t,r){linear_extrude(height=t)rounded_rect_2d(l,w,r);}

module qr_plate() {
    actual_l = max(base_length, qr_size + 8);
    actual_w = max(base_width,  qr_size + 8);
    qr_x = (actual_l - qr_size) / 2;
    qr_y = (actual_w - qr_size) / 2;
    cr   = apply_round_corner ? min(round_corner_radius, actual_l/2, actual_w/2) : 0;
    tab_x = keyring_position==1 ? actual_l+keyring_tab_diameter/2-keyring_tab_diameter*0.25
          : keyring_position==3 ? -keyring_tab_diameter/2+keyring_tab_diameter*0.25
          : actual_l/2;
    tab_y = keyring_position==0 ? actual_w+keyring_tab_diameter/2-keyring_tab_diameter*0.25
          : keyring_position==2 ? -keyring_tab_diameter/2+keyring_tab_diameter*0.25
          : actual_w/2;
    color(base_color)
        difference() {
            union() {
                rounded_plate(actual_l, actual_w, base_thickness, cr);
                if (add_keyring_hole)
                    translate([tab_x, tab_y, 0])
                        cylinder(h=base_thickness, d=keyring_tab_diameter, $fn=64);
            }
            if (add_keyring_hole)
                translate([tab_x, tab_y, -0.1])
                    cylinder(h=base_thickness+0.2, d=keyring_hole_diameter, $fn=64);
        }
    color(qr_color)
        translate([qr_x, qr_y, base_thickness])
            qr(message=qr_string, error_correction="H", width=qr_size, height=qr_size,
               thickness=qr_block_height, center=false, mask_pattern=0, encoding="UTF-8");
${centreBlock}
}

qr_plate();

// ==== scadqr library (embedded) ====
${scadqrLib}
`;
}

async function zipScadAndSvg(scadContent, svgContent, baseName) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const sink   = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
    });
    sink.on('finish', () => resolve(Buffer.concat(chunks)));

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', reject);
    archive.pipe(sink);
    archive.append(scadContent, { name: 'plate.scad' });
    archive.append(svgContent,  { name: 'logo.svg' });
    archive.finalize();
  });
}

async function buildSCAD(opts) {
  const { logoType, logoSvgContent, payeeName = 'qr' } = opts;
  const hasSvgLogo = logoType === 'svg' && !!logoSvgContent;
  const safeName   = payeeName.replace(/\s+/g, '_').toLowerCase();

  const scadContent = buildSCADString({ ...opts, hasSvgLogo });

  if (hasSvgLogo) {
    const zipBuffer = await zipScadAndSvg(scadContent, logoSvgContent, safeName);
    return { content: zipBuffer, isZip: true, filename: `${safeName}_qr.zip` };
  }

  return { content: scadContent, isZip: false, filename: `${safeName}_qr.scad` };
}

module.exports = { buildSCAD };
```

- [ ] **Step 2: Test SCAD (no logo)**

```bash
node -e "
const { buildSCAD } = require('./src/scad-builder');
buildSCAD({ qrString: 'https://example.com', payeeName: 'Test' })
  .then(r => console.log('isZip:', r.isZip, ' filename:', r.filename, ' len:', r.content.length));
"
```

Expected: `isZip: false  filename: test_qr.scad  len: <large>`

- [ ] **Step 3: Test SCAD (SVG logo → ZIP)**

```bash
node -e "
const { buildSCAD } = require('./src/scad-builder');
buildSCAD({
  qrString: 'https://example.com', payeeName: 'Test',
  logoType: 'svg',
  logoSvgContent: '<svg xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\"/></svg>',
}).then(r => console.log('isZip:', r.isZip, ' filename:', r.filename, ' size:', r.content.length));
"
```

Expected: `isZip: true  filename: test_qr.zip  size: <number>`

- [ ] **Step 4: Commit**

```bash
git add src/scad-builder.js
git commit -m "feat: SCAD builder with SVG ZIP and blank patch for PNG logos"
```

---

## Task 7: Rewrite public/index.html

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Replace public/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QR Generator — Branded + 3D Print</title>
<link rel="stylesheet" href="style.css">
</head>
<body>

<header class="header">
  <h1>QR Generator</h1>
  <p>Branded QR code - PNG image + OpenSCAD 3D print file</p>
</header>

<main class="main">

  <aside class="sidebar">

    <div class="section-title">QR Type</div>
    <div class="type-grid" id="typeGrid">
      <button class="type-card active" data-mode="url"           onclick="selectMode('url',this)">
        <span class="type-icon" id="icon-url"></span><span>Website</span>
      </button>
      <button class="type-card" data-mode="whatsapp"     onclick="selectMode('whatsapp',this)">
        <span class="type-icon" id="icon-whatsapp"></span><span>WhatsApp</span>
      </button>
      <button class="type-card" data-mode="instagram"    onclick="selectMode('instagram',this)">
        <span class="type-icon" id="icon-instagram"></span><span>Instagram</span>
      </button>
      <button class="type-card" data-mode="google_review" onclick="selectMode('google_review',this)">
        <span class="type-icon" id="icon-google_review"></span><span>Google Review</span>
      </button>
      <button class="type-card" data-mode="upi"          onclick="selectMode('upi',this)">
        <span class="type-icon" id="icon-upi"></span><span>UPI Pay</span>
      </button>
      <button class="type-card" data-mode="wifi"         onclick="selectMode('wifi',this)">
        <span class="type-icon" id="icon-wifi"></span><span>WiFi</span>
      </button>
    </div>

    <div id="fields-url" class="mode-fields">
      <div class="field">
        <label>Website URL *</label>
        <input type="url" id="url" placeholder="https://yourwebsite.com" />
      </div>
    </div>

    <div id="fields-whatsapp" class="mode-fields hidden">
      <div class="field">
        <label>Phone Number * (with country code, digits only)</label>
        <input type="tel" id="waPhone" placeholder="919876543210" />
      </div>
      <div class="field">
        <label>Pre-filled Message (optional)</label>
        <input type="text" id="waMessage" placeholder="Hello! I would like to enquire..." />
      </div>
    </div>

    <div id="fields-instagram" class="mode-fields hidden">
      <div class="field">
        <label>Instagram Username *</label>
        <input type="text" id="igUsername" placeholder="@yourbrand" />
      </div>
    </div>

    <div id="fields-google_review" class="mode-fields hidden">
      <div class="field">
        <label>Google Place ID *
          <a class="help-link"
             href="https://developers.google.com/maps/documentation/places/web-service/place-id"
             target="_blank" rel="noopener">How to find?</a>
        </label>
        <input type="text" id="grPlaceId" placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4" />
      </div>
    </div>

    <div id="fields-upi" class="mode-fields hidden">
      <div class="field">
        <label>UPI ID *</label>
        <input type="text" id="upiId" placeholder="name@upi or 9876543210@paytm" />
      </div>
      <div class="row2">
        <div class="field">
          <label>Payee Name *</label>
          <input type="text" id="payeeName" placeholder="Your Shop" />
        </div>
        <div class="field">
          <label>Amount (optional)</label>
          <input type="number" id="amount" placeholder="0.00" min="0" step="0.01" />
        </div>
      </div>
      <div class="field">
        <label>Note (optional)</label>
        <input type="text" id="note" placeholder="Payment for..." />
      </div>
    </div>

    <div id="fields-wifi" class="mode-fields hidden">
      <div class="field">
        <label>Network Name (SSID) *</label>
        <input type="text" id="wifiSsid" placeholder="MyHomeNetwork" />
      </div>
      <div class="field">
        <label>Password</label>
        <input type="text" id="wifiPassword" placeholder="Leave blank for open network" />
      </div>
      <div class="row2">
        <div class="field">
          <label>Security</label>
          <select id="wifiSecurity">
            <option value="WPA">WPA/WPA2</option>
            <option value="WEP">WEP</option>
            <option value="nopass">None (open)</option>
          </select>
        </div>
        <div class="field" style="display:flex;align-items:center;gap:8px;padding-top:20px;">
          <input type="checkbox" id="wifiHidden" style="width:auto;" />
          <label style="margin:0;cursor:pointer;" for="wifiHidden">Hidden network</label>
        </div>
      </div>
    </div>

    <div class="section-title">Branding</div>

    <div class="field">
      <label>Brand / Display Name</label>
      <input type="text" id="brandName" placeholder="Auto-filled from type fields" />
    </div>

    <div class="field">
      <label>
        Logo (PNG, JPG or SVG - max 2 MB)
        <span class="muted-note" id="svgNote" style="display:none;"> SVG enables 3D logo extrusion</span>
      </label>
      <div class="logo-upload-row">
        <label class="logo-upload-btn" for="logoFile">Upload logo</label>
        <input type="file" id="logoFile"
               accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
               style="display:none" onchange="handleLogoUpload(this)" />
        <button class="logo-clear-btn" id="logoClear"
                onclick="clearLogo()" style="display:none;">Remove</button>
      </div>
      <div class="logo-preview-wrap" id="logoPreviewWrap" style="display:none;">
        <img id="logoPreview" src="" alt="logo preview" />
      </div>
    </div>

    <div class="row2">
      <div class="field">
        <label>Header Color</label>
        <div class="color-wrap">
          <input type="color" id="primaryColor" value="#1a73e8"
            oninput="document.getElementById('primaryColorText').value=this.value" />
          <input type="text" id="primaryColorText" value="#1a73e8" maxlength="7"
            oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))document.getElementById('primaryColor').value=this.value" />
        </div>
      </div>
      <div class="field">
        <label>QR Dot Color</label>
        <div class="color-wrap">
          <input type="color" id="qrColor" value="#1a1a2e"
            oninput="document.getElementById('qrColorText').value=this.value" />
          <input type="text" id="qrColorText" value="#1a1a2e" maxlength="7"
            oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))document.getElementById('qrColor').value=this.value" />
        </div>
      </div>
    </div>

    <div class="section-title">Plate Dimensions (mm)</div>
    <div class="row3">
      <div class="field"><label>Width</label><input type="number" id="baseLength" value="90" min="30" max="300" /></div>
      <div class="field"><label>Height</label><input type="number" id="baseWidth" value="90" min="30" max="300" /></div>
      <div class="field"><label>QR Size</label><input type="number" id="qrSize" value="70" min="20" max="250" /></div>
    </div>
    <div class="row2">
      <div class="field"><label>Base Thickness</label><input type="number" id="baseThickness" value="2" min="0.5" max="10" step="0.5" /></div>
      <div class="field"><label>QR Raise Height</label><input type="number" id="qrRaise" value="0.8" min="0.2" max="5" step="0.1" /></div>
    </div>

    <div class="section-title">Options</div>
    <div class="toggle-row">
      <span>Rounded corners</span>
      <button class="toggle" id="t-rounded" onclick="tog('t-rounded','v-rounded')"></button>
    </div>
    <div id="v-rounded" class="sub-panel hidden">
      <div class="field"><label>Corner Radius (mm)</label><input type="number" id="cornerRadius" value="4" min="1" max="20" /></div>
    </div>
    <div class="toggle-row">
      <span>Keyring hole</span>
      <button class="toggle" id="t-keyring" onclick="tog('t-keyring','v-keyring')"></button>
    </div>
    <div id="v-keyring" class="sub-panel hidden">
      <div class="row2">
        <div class="field"><label>Hole Diameter (mm)</label><input type="number" id="holeDiameter" value="5" min="2" max="15" step="0.5" /></div>
        <div class="field"><label>Tab Diameter (mm)</label><input type="number" id="tabDiameter" value="12" min="5" max="25" step="0.5" /></div>
      </div>
      <div class="field">
        <label>Position</label>
        <select id="keyringPosition">
          <option value="0">Top</option><option value="1">Right</option>
          <option value="2">Bottom</option><option value="3">Left</option>
        </select>
      </div>
    </div>
    <div class="toggle-row">
      <span>Centre label text</span>
      <button class="toggle on" id="t-label" onclick="tog('t-label','v-label')"></button>
    </div>
    <div id="v-label" class="sub-panel">
      <div class="field"><label>Label text</label><input type="text" id="centreLabelText" value="QR" maxlength="12" /></div>
      <div class="row2">
        <div class="field"><label>Badge Width</label><input type="number" id="badgeWidth" value="30" min="10" max="80" /></div>
        <div class="field"><label>Badge Height</label><input type="number" id="badgeHeight" value="8" min="4" max="30" /></div>
      </div>
    </div>

    <button class="btn btn-primary btn-full" id="generateBtn" onclick="generate()">Generate QR</button>
    <div class="status-msg" id="statusMsg"></div>

  </aside>

  <section class="content">

    <div class="info-box">
      <strong>How it works</strong>
      Choose a type, fill in details, click Generate.
      Download <strong>.scad</strong> for 3D printing or <strong>PNG</strong> for sharing.
    </div>

    <div class="tabs">
      <button class="tab active" onclick="switchTab('preview',this)">Preview</button>
      <button class="tab" onclick="switchTab('howto',this)">Print Guide</button>
    </div>

    <div id="tab-preview" class="tab-panel">
      <div class="preview-card">
        <div class="preview-label">QR Card Preview</div>
        <div class="qr-display" id="qrDisplay">
          <div class="empty-state">Choose a type and click Generate</div>
        </div>
        <div id="saveHint" class="save-hint hidden">
          Long-press to save on mobile - Right-click then Save image as on desktop
        </div>
      </div>
    </div>

    <div id="tab-howto" class="tab-panel hidden">
      <div class="preview-card">
        <div class="preview-label">3D Printing Guide</div>
        <div class="how-list">
          <div class="how-step"><span class="step-n">1</span><div><strong>Download .scad file</strong>Click Download .scad after generating. If you uploaded an SVG logo you get a .zip — extract both files first.</div></div>
          <div class="how-step"><span class="step-n">2</span><div><strong>Open in OpenSCAD</strong>Free at <a href="https://openscad.org" target="_blank" rel="noopener">openscad.org</a>. Open the .scad file.</div></div>
          <div class="how-step"><span class="step-n">3</span><div><strong>Render</strong>Press <kbd>F6</kbd>. May take 1-2 minutes.</div></div>
          <div class="how-step"><span class="step-n">4</span><div><strong>Export STL</strong>File then Export then Export as STL.</div></div>
          <div class="how-step"><span class="step-n">5</span><div><strong>Slice and print</strong>Layer height 0.15mm, no supports needed.</div></div>
          <div class="how-step"><span class="step-n">tip</span><div><strong>Two-colour tip</strong>Print base in white up to <code>base_thickness</code> mm, pause and swap to black for raised QR modules.</div></div>
        </div>
      </div>
    </div>

    <div class="export-panel">
      <div class="preview-label">Export</div>
      <div class="export-grid">
        <div class="export-card">
          <div class="export-icon">3D</div>
          <div class="export-title">OpenSCAD File</div>
          <div class="export-desc" id="scadDesc">Parametric 3D model - render in OpenSCAD - export STL - print.</div>
          <button class="btn btn-cyan btn-full" id="btnScad" onclick="downloadSCAD()" disabled>Download .scad</button>
        </div>
        <div class="export-card">
          <div class="export-icon">IMG</div>
          <div class="export-title">PNG Image</div>
          <div class="export-desc">Branded QR card for digital sharing.</div>
          <button class="btn btn-green btn-full" id="btnPng" onclick="downloadPNG()" disabled>Save PNG</button>
        </div>
        <div class="export-card" id="stlCard" style="display:none;">
          <div class="export-icon">STL</div>
          <div class="export-title">STL File</div>
          <div class="export-desc">Direct STL via OpenSCAD (detected on this server).</div>
          <button class="btn btn-primary btn-full" id="btnStl" onclick="downloadSTL()" disabled>Export STL</button>
        </div>
      </div>
    </div>

    <div class="history-panel" id="historyPanel" style="display:none;">
      <div class="history-header">
        <div class="preview-label">Recent</div>
        <button class="history-clear" onclick="clearHistory()">Clear all</button>
      </div>
      <div class="history-grid" id="historyGrid"></div>
    </div>

  </section>
</main>

<script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify page loads**

Restart server and open `http://localhost:3000`. You should see:
- Six type buttons in a 2x3 grid
- Website fields visible, others hidden
- Logo upload section under Branding
- History panel hidden

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: redesign UI with type grid, logo upload, history section"
```

---

## Task 8: Rewrite public/app.js

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Replace public/app.js**

```js
/* ── QR Type definitions (client-side) ─────────────────────────── */
const QR_TYPES = {
  url: {
    label: 'Website', subtitle: 'Scan to Visit', centreLabelText: 'URL',
    defaultColor: '#1a73e8',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    getLabel: d => d.url || 'Website',
    buildQrString: d => (d.url || '').trim(),
    validate: d => !d.url ? 'URL is required' : null,
  },
  whatsapp: {
    label: 'WhatsApp', subtitle: 'Scan to Chat', centreLabelText: 'WA',
    defaultColor: '#25D366',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884"/></svg>',
    getLabel: d => d.waPhone || 'WhatsApp',
    buildQrString: d => {
      const p = (d.waPhone || '').replace(/\D/g, '');
      return `https://wa.me/${p}${d.waMessage ? '?text=' + encodeURIComponent(d.waMessage) : ''}`;
    },
    validate: d => !d.waPhone ? 'Phone number is required' : null,
  },
  instagram: {
    label: 'Instagram', subtitle: 'Scan to Follow', centreLabelText: 'IG',
    defaultColor: '#E1306C',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    getLabel: d => d.igUsername || 'Instagram',
    buildQrString: d => `https://instagram.com/${(d.igUsername || '').replace(/^@/, '').trim()}`,
    validate: d => !d.igUsername ? 'Username is required' : null,
  },
  google_review: {
    label: 'Google Review', subtitle: 'Leave a Review', centreLabelText: 'G',
    defaultColor: '#4285F4',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
    getLabel: d => d.grPlaceId || 'Google Review',
    buildQrString: d => `https://search.google.com/local/writereview?placeid=${encodeURIComponent(d.grPlaceId || '')}`,
    validate: d => !d.grPlaceId ? 'Place ID is required' : null,
  },
  upi: {
    label: 'UPI Payment', subtitle: 'Scan to Pay', centreLabelText: 'UPI',
    defaultColor: '#7c3aed',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="5" x2="18" y2="5"/><line x1="6" y1="10" x2="18" y2="10"/><path d="M6 5h12a6 6 0 0 1 0 10H6"/><line x1="9" y1="20" x2="18" y2="10"/></svg>',
    getLabel: d => d.payeeName || d.upiId || 'UPI',
    buildQrString: d => {
      let s = `upi://pay?pa=${encodeURIComponent(d.upiId)}&pn=${encodeURIComponent(d.payeeName)}&cu=INR`;
      if (d.amount && parseFloat(d.amount) > 0) s += `&am=${parseFloat(d.amount).toFixed(2)}`;
      if (d.note) s += `&tn=${encodeURIComponent(d.note)}`;
      return s;
    },
    validate: d => !d.upiId ? 'UPI ID is required' : !d.payeeName ? 'Payee name is required' : null,
  },
  wifi: {
    label: 'WiFi', subtitle: 'Scan to Connect', centreLabelText: 'WiFi',
    defaultColor: '#0ea5e9',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M10.54 16.1a6 6 0 0 1 2.92 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
    getLabel: d => d.wifiSsid || 'WiFi',
    buildQrString: d => {
      const esc = s => (s || '').replace(/([\\;,"':])/, '\\$1');
      return `WIFI:T:${d.wifiSecurity || 'WPA'};S:${esc(d.wifiSsid)};P:${esc(d.wifiPassword)};H:${!!d.wifiHidden};;`;
    },
    validate: d => !d.wifiSsid ? 'Network name is required' : null,
  },
};

/* ── State ──────────────────────────────────────────────────────── */
let state = {
  mode:              'url',
  pngBase64:         null,
  scadContent:       null,
  isZip:             false,
  filename:          'qr',
  logoDataUrl:       null,
  logoType:          null,
  openscadAvailable: false,
};

/* ── DOM helpers ────────────────────────────────────────────────── */
const $   = id => document.getElementById(id);
const val = id => { const el = $(id); return el ? el.value.trim() : ''; };
const checked = id => { const el = $(id); return el ? el.classList.contains('on') : false; };

/* ── Init ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  injectTypeIcons();
  selectMode('url', document.querySelector('[data-mode="url"]'));
  checkOpenSCAD();
  renderHistory();
});

function injectTypeIcons() {
  Object.entries(QR_TYPES).forEach(([mode, def]) => {
    const el = $(`icon-${mode}`);
    if (el) el.innerHTML = def.icon;
  });
}

function checkOpenSCAD() {
  fetch('/api/openscad-status')
    .then(r => r.json())
    .then(d => {
      state.openscadAvailable = d.available;
      if (d.available) $('stlCard').style.display = '';
    })
    .catch(() => {});
}

/* ── Mode switching ─────────────────────────────────────────────── */
function selectMode(mode, btn) {
  state.mode = mode;
  document.querySelectorAll('.mode-fields').forEach(el => el.classList.add('hidden'));
  const fieldsEl = $(`fields-${mode}`);
  if (fieldsEl) fieldsEl.classList.remove('hidden');

  document.querySelectorAll('.type-card').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const def = QR_TYPES[mode];
  if (def && !state.logoDataUrl) {
    $('primaryColor').value     = def.defaultColor;
    $('primaryColorText').value = def.defaultColor;
  }
  const labelInput = $('centreLabelText');
  if (labelInput && def) labelInput.value = def.centreLabelText;
}

/* ── Logo upload ────────────────────────────────────────────────── */
function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showStatus('Logo must be under 2 MB', 'err');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    state.logoDataUrl = e.target.result;
    state.logoType    = file.type === 'image/svg+xml' ? 'svg' : 'png';
    $('logoPreview').src              = e.target.result;
    $('logoPreviewWrap').style.display = '';
    $('logoClear').style.display      = 'inline-flex';
    $('svgNote').style.display        = state.logoType === 'svg' ? 'inline' : 'none';
    if (state.logoType === 'svg') {
      $('scadDesc').textContent = 'SVG logo: download is a .zip (plate.scad + logo.svg). Extract both before opening in OpenSCAD.';
    }
  };
  reader.readAsDataURL(file);
}

function clearLogo() {
  state.logoDataUrl = null;
  state.logoType    = null;
  $('logoFile').value               = '';
  $('logoPreviewWrap').style.display = 'none';
  $('logoClear').style.display       = 'none';
  $('svgNote').style.display         = 'none';
  $('scadDesc').textContent          = 'Parametric 3D model - render in OpenSCAD - export STL - print.';
}

/* ── Collect form data ──────────────────────────────────────────── */
function getFormData() {
  return {
    mode:         state.mode,
    url:          val('url'),
    waPhone:      val('waPhone'),
    waMessage:    val('waMessage'),
    igUsername:   val('igUsername'),
    grPlaceId:    val('grPlaceId'),
    upiId:        val('upiId'),
    payeeName:    val('payeeName'),
    amount:       val('amount'),
    note:         val('note'),
    wifiSsid:     val('wifiSsid'),
    wifiPassword: val('wifiPassword'),
    wifiSecurity: val('wifiSecurity'),
    wifiHidden:   $('wifiHidden') ? $('wifiHidden').checked : false,
    brandName:    val('brandName'),
    primaryColor: val('primaryColor'),
    qrColor:      val('qrColor'),
    logoDataUrl:  state.logoDataUrl,
    logoType:     state.logoType,
    baseLength:     +val('baseLength')     || 90,
    baseWidth:      +val('baseWidth')      || 90,
    baseThickness:  +val('baseThickness')  || 2,
    qrSize:         +val('qrSize')         || 70,
    qrRaise:        +val('qrRaise')        || 0.8,
    roundedCorners: checked('t-rounded'),
    cornerRadius:   +val('cornerRadius')   || 4,
    keyringHole:    checked('t-keyring'),
    holeDiameter:   +val('holeDiameter')   || 5,
    tabDiameter:    +val('tabDiameter')    || 12,
    keyringPosition:+val('keyringPosition'),
    centreLabel:    checked('t-label'),
    centreLabelText:val('centreLabelText') || QR_TYPES[state.mode]?.centreLabelText || 'QR',
    badgeWidth:     +val('badgeWidth')     || 30,
    badgeHeight:    +val('badgeHeight')    || 8,
  };
}

/* ── Generate ───────────────────────────────────────────────────── */
async function generate() {
  const data    = getFormData();
  const typeDef = QR_TYPES[data.mode];
  const err     = typeDef?.validate(data);
  if (err) { showStatus(err, 'err'); return; }

  showStatus('Generating...', 'info');
  $('generateBtn').disabled = true;

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error || 'Server error');
    }
    const result = await res.json();
    state.pngBase64   = result.pngBase64;
    state.scadContent = result.scadFile;
    state.isZip       = result.isZip;
    state.filename    = result.filename || 'qr';

    renderPreview('data:image/png;base64,' + result.pngBase64);
    enableButtons();
    saveHistory(data, result.pngBase64);

    const msg = result.canvasMissing
      ? 'QR generated (plain QR - run npm install canvas for branded card)'
      : 'QR generated!';
    showStatus(msg, 'ok');
  } catch (e) {
    console.warn('API unavailable, using client-side mode:', e.message);
    await generateClientSide(data);
  } finally {
    $('generateBtn').disabled = false;
  }
}

/* ── Client-side fallback ───────────────────────────────────────── */
async function generateClientSide(data) {
  if (!window.QRCode) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
  }
  const typeDef  = QR_TYPES[data.mode];
  const qrString = typeDef ? typeDef.buildQrString(data) : data.url || '';

  const tmpDiv = Object.assign(document.createElement('div'),
    { style: 'position:absolute;left:-9999px;top:-9999px;' });
  document.body.appendChild(tmpDiv);

  try {
    new QRCode(tmpDiv, {
      text: qrString, width: 300, height: 300,
      colorDark: data.qrColor || '#1a1a2e', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  } catch {
    document.body.removeChild(tmpDiv);
    showStatus('QR generation failed - check your inputs', 'err');
    return;
  }

  await sleep(200);
  const qrCanvas = tmpDiv.querySelector('canvas');
  if (!qrCanvas) {
    document.body.removeChild(tmpDiv);
    showStatus('QR render failed', 'err');
    return;
  }

  const pngDataURL = buildCardCanvas(qrCanvas, data);
  document.body.removeChild(tmpDiv);

  state.pngBase64   = pngDataURL.replace(/^data:image\/png;base64,/, '');
  state.scadContent = buildSCADClient(qrString, data);
  state.isZip       = false;
  state.filename    = safeName(data) + '_qr.scad';

  renderPreview(pngDataURL);
  enableButtons();
  saveHistory(data, state.pngBase64);
  showStatus('Generated (standalone mode). SCAD file needs scadqr_library.scad placed alongside it.', 'ok');
}

/* ── Preview & buttons ──────────────────────────────────────────── */
function renderPreview(src) {
  const disp = $('qrDisplay');
  disp.innerHTML = '';
  const img = document.createElement('img');
  img.src   = src;
  img.title = 'Right-click then Save image as';
  disp.appendChild(img);
  $('saveHint').classList.remove('hidden');
}

function enableButtons() {
  $('btnScad').disabled = false;
  $('btnPng').disabled  = false;
  if (state.openscadAvailable && !state.isZip) $('btnStl').disabled = false;
}

/* ── Downloads ──────────────────────────────────────────────────── */
function downloadSCAD() {
  if (!state.scadContent) return;
  if (state.isZip) {
    const bytes = atob(state.scadContent);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    downloadBlob(new Blob([arr], { type: 'application/zip' }), state.filename);
  } else {
    downloadBlob(new Blob([state.scadContent], { type: 'text/plain' }), state.filename);
  }
  showStatus('SCAD file downloaded', 'ok');
}

function downloadPNG() {
  if (!state.pngBase64) return;
  const bytes = atob(state.pngBase64);
  const arr   = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  downloadBlob(new Blob([arr], { type: 'image/png' }), safeName(getFormData()) + '_qr.png');
  showStatus('PNG saved!', 'ok');
}

function downloadSTL() {
  const data = getFormData();
  showStatus('Rendering STL (may take up to 2 minutes)...', 'info');
  $('btnStl').disabled = true;
  fetch('/api/download/stl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
    .then(r => r.ok ? r.blob() : r.json().then(e => Promise.reject(new Error(e.error))))
    .then(blob => {
      downloadBlob(blob, safeName(data) + '_qr.stl');
      showStatus('STL downloaded!', 'ok');
    })
    .catch(e => showStatus('STL export failed: ' + e.message, 'err'))
    .finally(() => { $('btnStl').disabled = false; });
}

/* ── History ────────────────────────────────────────────────────── */
const HISTORY_KEY = 'qrgen_history';

function saveHistory(formData, pngBase64) {
  const entries = getHistory();
  const typeDef = QR_TYPES[formData.mode];
  entries.unshift({
    timestamp: Date.now(),
    mode:      formData.mode,
    label:     typeDef ? typeDef.getLabel(formData) : formData.mode,
    formData,
    thumb:     downsamplePng(pngBase64, 80),
  });
  const trimmed = entries.slice(0, 5);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(
      trimmed.map(e => ({ ...e, thumb: null }))
    ));
  }
  renderHistory();
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

function renderHistory() {
  const entries = getHistory();
  const panel   = $('historyPanel');
  const grid    = $('historyGrid');
  if (!entries.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  // Build history cards using safe DOM methods to avoid XSS
  grid.innerHTML = '';
  entries.forEach((e, i) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.addEventListener('click', () => restoreHistory(i));

    if (e.thumb) {
      const img = document.createElement('img');
      img.src       = 'data:image/png;base64,' + e.thumb;
      img.className = 'history-thumb';
      img.alt       = '';
      card.appendChild(img);
    }

    const info  = document.createElement('div');
    info.className = 'history-info';

    const lbl = document.createElement('div');
    lbl.className   = 'history-label';
    lbl.textContent = e.label;
    info.appendChild(lbl);

    const meta = document.createElement('div');
    meta.className   = 'history-meta';
    const def        = QR_TYPES[e.mode];
    meta.textContent = (def ? def.label : e.mode) + ' - ' + timeAgo(e.timestamp);
    info.appendChild(meta);

    card.appendChild(info);
    grid.appendChild(card);
  });
}

function restoreHistory(idx) {
  const entry = getHistory()[idx];
  if (!entry) return;
  const d = entry.formData;

  selectMode(d.mode, document.querySelector('[data-mode="' + d.mode + '"]'));

  const fields = ['url','waPhone','waMessage','igUsername','grPlaceId',
    'upiId','payeeName','amount','note','wifiSsid','wifiPassword',
    'brandName','centreLabelText','baseLength','baseWidth','baseThickness',
    'qrSize','qrRaise','cornerRadius','holeDiameter','tabDiameter','badgeWidth','badgeHeight'];
  fields.forEach(id => { const el = $(id); if (el && d[id] != null) el.value = d[id]; });

  if (d.primaryColor) { $('primaryColor').value = d.primaryColor; $('primaryColorText').value = d.primaryColor; }
  if (d.qrColor)      { $('qrColor').value      = d.qrColor;      $('qrColorText').value      = d.qrColor; }
  if ($('wifiSecurity')    && d.wifiSecurity    != null) $('wifiSecurity').value    = d.wifiSecurity;
  if ($('keyringPosition') && d.keyringPosition != null) $('keyringPosition').value = d.keyringPosition;

  [['t-rounded','v-rounded',d.roundedCorners],
   ['t-keyring', 'v-keyring', d.keyringHole],
   ['t-label',   'v-label',   d.centreLabel]].forEach(([btnId, panelId, on]) => {
    const btn = $(btnId); if (!btn) return;
    btn.classList.toggle('on', !!on);
    const panel = $(panelId); if (panel) panel.classList.toggle('hidden', !on);
  });

  generate();
}

function downsamplePng(base64, size) {
  try {
    const img = new Image();
    img.src   = 'data:image/png;base64,' + base64;
    const c   = document.createElement('canvas');
    c.width   = size; c.height = size;
    c.getContext('2d').drawImage(img, 0, 0, size, size);
    return c.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  } catch { return null; }
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

/* ── Client-side card renderer (standalone fallback) ────────────── */
function buildCardCanvas(qrCanvas, data) {
  const primaryColor = data.primaryColor || '#1a73e8';
  const typeDef  = QR_TYPES[data.mode];
  const brandName = data.brandName || (typeDef ? typeDef.getLabel(data) : 'QR');
  const subtitle  = typeDef ? typeDef.subtitle : 'Scan QR Code';
  const QS=280, W=380, HH=66, SC=2, H=HH+QS+95;
  const out = document.createElement('canvas');
  out.width = W*SC; out.height = H*SC;
  const ctx = out.getContext('2d');
  ctx.scale(SC, SC);
  const lum = hex => {
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return .299*r+.587*g+.114*b;
  };
  const onColor = lum(primaryColor) > 150 ? '#1a1a2e' : '#ffffff';
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
  function rrTop(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
  ctx.shadowColor='rgba(0,0,0,0.15)';ctx.shadowBlur=16;ctx.shadowOffsetY=4;
  ctx.fillStyle='#ffffff';rr(0,0,W,H,14);ctx.fill();
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.fillStyle=primaryColor;rrTop(0,0,W,HH,14);ctx.fill();
  const AV=38,ax=14,ay=(HH-AV)/2;
  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.beginPath();ctx.arc(ax+AV/2,ay+AV/2,AV/2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=onColor;ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText((brandName||'?').charAt(0).toUpperCase(),ax+AV/2,ay+AV/2);
  ctx.fillStyle=onColor;ctx.font='bold 13px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillText(brandName,ax+AV+10,16);
  ctx.fillStyle=onColor+'bb';ctx.font='10px sans-serif';ctx.fillText(subtitle,ax+AV+10,33);
  const qx=(W-QS)/2,qy=HH+12;
  ctx.fillStyle='#f0f0f4';rr(qx-5,qy-5,QS+10,QS+10,7);ctx.fill();
  ctx.drawImage(qrCanvas,qx,qy,QS,QS);
  ctx.fillStyle='#1a1a2e';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText(brandName,W/2,qy+QS+14);
  ctx.fillStyle='#ccc';ctx.font='9px sans-serif';ctx.textBaseline='bottom';
  ctx.fillText('QR Generator',W/2,H-6);
  return out.toDataURL('image/png');
}

/* ── Client-side SCAD builder (standalone — needs library alongside) */
function buildSCADClient(qrString, data) {
  const {baseLength=90,baseWidth=90,baseThickness=2,qrSize=70,qrRaise=0.8,
    roundedCorners=false,cornerRadius=4,keyringHole=false,holeDiameter=5,
    tabDiameter=12,keyringPosition=0,centreLabel=true,centreLabelText='QR',
    badgeWidth=30,badgeHeight=8} = data;
  const textSize = Math.round(badgeHeight*0.55*10)/10;
  return `// QR Generator - client-side SCAD (standalone mode)
// NOTE: Requires scadqr_library.scad in the same folder.
// Download from: https://github.com/xypwn/scadqr
// Use the server to get a self-contained file.

include <scadqr_library.scad>

qr_string="${qrString}";
base_length=${baseLength};base_width=${baseWidth};base_thickness=${baseThickness};
qr_size=${qrSize};qr_block_height=${qrRaise};
apply_round_corner=${roundedCorners};round_corner_radius=${cornerRadius};
add_keyring_hole=${keyringHole};keyring_hole_diameter=${holeDiameter};
keyring_tab_diameter=${tabDiameter};keyring_position=${keyringPosition};
show_centre_label=${centreLabel};centre_label_text="${centreLabelText}";
centre_badge_width=${badgeWidth};centre_badge_height=${badgeHeight};
centre_badge_thickness=0.4;centre_text_height=0.6;centre_text_size=${textSize};
base_color=[1,1,1];qr_color=[0,0,0];label_color=[0,0,0];

module rounded_rect_2d(l,w,r){if(r<=0){square([l,w]);}else{hull(){translate([r,r])circle(r=r,$fn=64);translate([l-r,r])circle(r=r,$fn=64);translate([l-r,w-r])circle(r=r,$fn=64);translate([r,w-r])circle(r=r,$fn=64);}}}
module rounded_plate(l,w,t,r){linear_extrude(height=t)rounded_rect_2d(l,w,r);}
module qr_plate(){actual_l=max(base_length,qr_size+8);actual_w=max(base_width,qr_size+8);qr_x=(actual_l-qr_size)/2;qr_y=(actual_w-qr_size)/2;cr=apply_round_corner?min(round_corner_radius,actual_l/2,actual_w/2):0;color([1,1,1])rounded_plate(actual_l,actual_w,base_thickness,cr);color([0,0,0])translate([qr_x,qr_y,base_thickness])qr(message=qr_string,error_correction="H",width=qr_size,height=qr_size,thickness=qr_block_height,center=false,mask_pattern=0,encoding="UTF-8");}
qr_plate();`;
}

/* ── Utilities ──────────────────────────────────────────────────── */
function safeName(data) {
  const typeDef = QR_TYPES[data.mode];
  const label   = typeDef ? typeDef.getLabel(data) : data.mode;
  return (label || data.mode).replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'qr';
}

function tog(btnId, panelId) {
  const btn   = $(btnId);
  const panel = $(panelId);
  btn.classList.toggle('on');
  panel.classList.toggle('hidden', !btn.classList.contains('on'));
}

function switchTab(name, el) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  $('tab-' + name).classList.remove('hidden');
  el.classList.add('active');
}

function showStatus(msg, type) {
  const el     = $('statusMsg');
  el.textContent = msg;
  el.className   = 'status-msg show ' + (type || 'ok');
  setTimeout(() => el.classList.remove('show'), 5000);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = src;
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') generate();
});
```

- [ ] **Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat: app.js with 6 modes, logo upload, history, safe DOM rendering"
```

---

## Task 9: Update public/style.css

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Append to end of public/style.css**

```css
/* ── Type selector grid ─────────────────────────────────────────── */
.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: .5rem;
}

.type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px 6px;
  background: #1c1c25;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  font-size: 10px;
  color: var(--muted);
  font-family: 'DM Sans', sans-serif;
  font-weight: 500;
  transition: all .15s;
}
.type-card:hover { border-color: var(--accent); color: var(--text); }
.type-card.active {
  border-color: var(--accent);
  background: rgba(124,58,237,.12);
  color: var(--text);
}
.type-icon { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
.type-icon svg { width: 18px; height: 18px; }

/* ── Mode fields ────────────────────────────────────────────────── */
.mode-fields.hidden { display: none; }

/* ── Logo upload ────────────────────────────────────────────────── */
.logo-upload-row { display: flex; align-items: center; gap: 8px; }

.logo-upload-btn {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  background: #1c1c25;
  border: 1px dashed var(--border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  transition: border-color .15s;
}
.logo-upload-btn:hover { border-color: var(--accent); color: var(--text); }

.logo-clear-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted);
  font-size: 11px;
  padding: 5px 8px;
  cursor: pointer;
}
.logo-clear-btn:hover { color: var(--error-fg); border-color: var(--error-fg); }

.logo-preview-wrap {
  margin-top: 8px;
  background: #1c1c25;
  border-radius: 8px;
  padding: 8px;
  display: inline-block;
}
.logo-preview-wrap img {
  max-height: 60px;
  max-width: 120px;
  border-radius: 4px;
  object-fit: contain;
  display: block;
}

.muted-note { color: var(--muted); font-weight: 400; }

.help-link {
  font-size: 10px;
  color: var(--cyan);
  margin-left: 6px;
  text-decoration: none;
}
.help-link:hover { text-decoration: underline; }

/* ── History panel ──────────────────────────────────────────────── */
.history-panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.1rem;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.history-clear {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
}
.history-clear:hover { color: var(--error-fg); }

.history-grid { display: flex; flex-direction: column; gap: 6px; }

.history-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #1c1c25;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color .15s;
}
.history-card:hover { border-color: var(--accent); }

.history-thumb {
  width: 40px;
  height: 40px;
  border-radius: 5px;
  object-fit: cover;
  background: #fff;
  flex-shrink: 0;
}

.history-info { flex: 1; min-width: 0; }

.history-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta { font-size: 10px; color: var(--muted); margin-top: 2px; }
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat: add type grid, logo upload, history card styles"
```

---

## Task 10: End-to-End Test

- [ ] **Step 1: Start server**

```bash
npm start
```

Open `http://localhost:3000`

- [ ] **Step 2: Test each QR type**

For each type below, fill the required field and click Generate. Verify PNG preview appears and both download buttons enable.

| Type | Input | Expected QR string starts with |
|------|-------|-------------------------------|
| Website | `https://example.com` | `https://example.com` |
| WhatsApp | `919876543210` | `https://wa.me/919876543210` |
| Instagram | `@myshop` | `https://instagram.com/myshop` |
| Google Review | `ChIJtest123` | `https://search.google.com/local/writereview` |
| UPI Payment | UPI ID: `test@upi`, Name: `Test Shop` | `upi://pay?pa=test%40upi` |
| WiFi | SSID: `HomeNet`, Password: `pass` | `WIFI:T:WPA;S:HomeNet` |

- [ ] **Step 3: Test PNG logo upload**

1. Select Website, enter `https://example.com`
2. Upload any PNG image under 2MB as logo
3. Generate — verify logo appears in card header circle and QR centre
4. Download .scad — verify file extension is `.scad` (not `.zip`)

- [ ] **Step 4: Test SVG logo upload**

Create `test.svg` with content:
```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#333"/></svg>
```
1. Upload `test.svg` as logo
2. Verify scad description updates to mention `.zip`
3. Generate and click Download .scad
4. Verify downloaded file is a `.zip`
5. Extract zip and confirm it contains `plate.scad` and `logo.svg`

- [ ] **Step 5: Test history**

1. Generate 3 QR codes of different types
2. History panel appears with 3 cards
3. Click a history card — form restores and QR regenerates
4. Click Clear all — history panel hides

- [ ] **Step 6: Test service color defaults**

1. Click WhatsApp — header color picker shows `#25D366`
2. Click UPI — header color picker shows `#7c3aed`
3. Upload a logo, then switch to Instagram — logo stays, color changes to `#E1306C`

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: universal QR generator v2 - all 6 types, logo, history"
```

---

## Task 11: STL Export (Optional — skip if OpenSCAD not installed)

- [ ] **Step 1: Check OpenSCAD availability**

```bash
openscad --version
```

If this fails with "not found", skip this task entirely.

- [ ] **Step 2: Verify status endpoint**

```bash
curl http://localhost:3000/api/openscad-status
```

Expected: `{"available":true,"version":"OpenSCAD version ..."}`

- [ ] **Step 3: Verify STL button appears**

Reload `http://localhost:3000`. A third export card "STL File" should be visible.

- [ ] **Step 4: Test STL download**

Generate a QR with no SVG logo. Click Export STL. After up to 2 minutes a `.stl` file downloads. Open it in a slicer (Bambu Studio, PrusaSlicer, or Cura) to confirm the plate with raised QR modules is visible.

---

## Implementer Checklist

- [ ] All 6 QR types produce scannable codes (test each with a phone camera)
- [ ] PNG card renders at 2x resolution with drop shadow
- [ ] Badge width/height form values are reflected in the PNG card centre overlay
- [ ] SVG logo download is a `.zip` containing both files
- [ ] PNG logo download is a plain `.scad`
- [ ] History stores max 5 entries; thumbnails are 80x80px
- [ ] Standalone mode (no server) shows warning about needing scadqr_library.scad
- [ ] canvas not installed: server returns `canvasMissing: true`, frontend shows informative message
- [ ] Type selector cards show correct icons and apply correct default colors on switch
- [ ] No XSS: all user-supplied content in DOM is set via textContent, not innerHTML
