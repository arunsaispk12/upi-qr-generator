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

  // Pre-load logo once for reuse in header + centre
  let logoImg = null;
  if (logoDataUrl) {
    try { logoImg = await loadImage(logoDataUrl); } catch { logoImg = null; }
  }

  // Coloured header
  ctx.fillStyle = primaryColor;
  roundRectTop(ctx, 0, 0, W, HH, 16);
  ctx.fill();

  // Logo or letter-avatar in header
  const AV = 40, ax = 16, ay = (HH - AV) / 2;
  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + AV/2, ay + AV/2, AV/2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, ax, ay, AV, AV);
    ctx.restore();
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

  if (logoImg) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, lbx - 2, lby - 2, bwPx + 4, bhPx + 4, 4);
    ctx.fill();
    roundRect(ctx, lbx, lby, bwPx, bhPx, 4);
    ctx.clip();
    ctx.drawImage(logoImg, lbx, lby, bwPx, bhPx);
    ctx.restore();
  } else if (centreText && centreText.trim()) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, lbx, lby, bwPx, bhPx, 4);
    ctx.fill();
    ctx.fillStyle    = primaryColor;
    ctx.font         = `bold ${Math.max(8, bhPx * 0.55)}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(centreText.toUpperCase(), qx + QS/2, qy + QS/2);
    ctx.restore();
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
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return 128; // safe mid-value default
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
