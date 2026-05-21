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
