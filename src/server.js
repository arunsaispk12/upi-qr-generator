const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { QR_TYPES }       = require('./qr-types');
const { buildSCAD }      = require('./scad-builder');
const { generateQRCard } = require('./image-generator');
const { getQrMatrix }    = require('./qr-matrix');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Coerce a numeric plate field to a finite number clamped to [min,max], else def.
// Every numeric field is interpolated raw into the .scad source, so a non-numeric
// value (e.g. "1; cube([9,9,9])") would inject OpenSCAD — coercion closes that.
function num(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function extractPlateOpts(body) {
  const { centreLabelText } = body;
  return {
    baseLength:      num(body.baseLength,     90, 10, 500),
    baseWidth:       num(body.baseWidth,      90, 10, 500),
    baseThickness:   num(body.baseThickness,   2, 0.4, 50),
    qrSize:          num(body.qrSize,         70, 5, 500),
    qrRaise:         num(body.qrRaise,       0.8, 0, 10),
    roundedCorners:  !!body.roundedCorners,
    cornerRadius:    num(body.cornerRadius,    4, 0, 100),
    keyringHole:     !!body.keyringHole,
    holeDiameter:    num(body.holeDiameter,    5, 0.5, 50),
    tabDiameter:     num(body.tabDiameter,    12, 1, 100),
    keyringPosition: num(body.keyringPosition, 0, 0, 3),
    centreLabel:     body.centreLabel === undefined ? true : !!body.centreLabel,
    centreLabelText: centreLabelText || 'QR',
    badgeWidth:      num(body.badgeWidth,     30, 1, 200),
    badgeHeight:     num(body.badgeHeight,     8, 1, 100),
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
      qrMatrix:      getQrMatrix(qrString),
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

    const validationError = typeDef.validate(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/download/png', async (req, res) => {
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
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/gi, '')
      .toLowerCase() || 'qr';
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_qr.png"`);
    res.send(pngResult.buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Universal QR Generator at http://localhost:${PORT}\n`);
});

module.exports = app;
