/**
 * image-generator.js — Generates a branded PNG QR card
 * Uses the `qrcode` npm package + `canvas` for server-side rendering.
 * Falls back gracefully to plain QR if canvas is unavailable.
 */

const QRCode = require('qrcode');

/**
 * Generate a branded QR card as a PNG Buffer.
 * @param {Object} opts
 * @param {string}  opts.upiString   - The upi://pay?... string to encode
 * @param {string}  opts.payeeName   - Payee name displayed on card
 * @param {string}  opts.upiId       - UPI ID displayed on card
 * @param {string}  [opts.brandName] - Brand/shop name (defaults to payeeName)
 * @param {string}  [opts.amount]    - Optional amount string
 * @param {string}  [opts.primaryColor='#7c3aed'] - Brand color hex
 * @param {string}  [opts.qrColor='#1a1a2e']      - QR dot color hex
 * @param {string}  [opts.centreText='']           - Text overlay in QR centre
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateQRCard(opts) {
  const {
    qrString,
    upiString,
    payeeName,
    upiId,
    brandName    = opts.payeeName || opts.brandName,
    amount       = '',
    primaryColor = '#7c3aed',
    qrColor      = '#1a1a2e',
    centreText   = '',
  } = opts;

  // Support both old (upiString) and new (qrString) API
  const qrData = qrString || upiString;

  // Generate raw QR as a data URL (works without canvas)
  const qrDataURL = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'H',
    width: 400,
    margin: 1,
    color: {
      dark:  qrColor,
      light: '#ffffff',
    },
  });

  // Try to use canvas for a branded card; fall back to raw QR
  try {
    const { createCanvas, loadImage } = require('canvas');
    const buffer = await buildBrandedCard({
      createCanvas, loadImage,
      qrDataURL, payeeName, upiId, brandName, amount, primaryColor, centreText,
    });
    return { buffer, canvasMissing: false };
  } catch {
    // canvas not installed — return plain QR PNG
    const base64 = qrDataURL.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    return { buffer, canvasMissing: true };
  }
}

/** Internal: render the full branded card onto a canvas */
async function buildBrandedCard({
  createCanvas, loadImage,
  qrDataURL, payeeName, upiId, brandName, amount, primaryColor, centreText,
}) {
  const QS = 320;        // QR image size
  const W  = 420;        // Card width
  const HH = 72;         // Header height
  const SC = 2;          // HiDPI scale
  const hasAmt = amount && parseFloat(amount) > 0;
  const H = HH + QS + (hasAmt ? 130 : 100);

  const canvas = createCanvas(W * SC, H * SC);
  const ctx = canvas.getContext('2d');
  ctx.scale(SC, SC);

  const onColor = luminance(primaryColor) > 150 ? '#1a1a2e' : '#ffffff';

  // White rounded card background
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 0, 0, W, H, 16);
  ctx.fill();

  // Coloured header bar
  ctx.fillStyle = primaryColor;
  roundRectTop(ctx, 0, 0, W, HH, 16);
  ctx.fill();

  // Header: brand initial circle
  const AV = 40, ax = 16, ay = (HH - AV) / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.arc(ax + AV/2, ay + AV/2, AV/2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = onColor;
  ctx.font      = `bold 18px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(brandName.charAt(0).toUpperCase(), ax + AV/2, ay + AV/2);

  // Header: brand name + subtitle
  const bx = ax + AV + 12;
  ctx.fillStyle = onColor;
  ctx.font      = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(brandName, bx, 18);
  ctx.fillStyle = onColor + 'bb';
  ctx.font      = '11px sans-serif';
  ctx.fillText('Scan to Pay · UPI', bx, 38);

  // QR image
  const qrImg = await loadImage(qrDataURL);
  const qx = (W - QS) / 2, qy = HH + 14;
  ctx.fillStyle = '#f0f0f4';
  roundRect(ctx, qx - 6, qy - 6, QS + 12, QS + 12, 8);
  ctx.fill();
  ctx.drawImage(qrImg, qx, qy, QS, QS);

  // Centre label overlay
  if (centreText && centreText.trim()) {
    const bw = 70, bh = 22;
    const lbx = qx + (QS - bw) / 2;
    const lby = qy + (QS - bh) / 2;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, lbx, lby, bw, bh, 4);
    ctx.fill();
    ctx.fillStyle = primaryColor;
    ctx.font = `bold 11px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(centreText.toUpperCase(), qx + QS/2, qy + QS/2);
  }

  // Info section
  const iy = qy + QS + 16;
  ctx.fillStyle    = '#1a1a2e';
  ctx.font         = 'bold 16px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(payeeName, W/2, iy);

  ctx.fillStyle = '#999999';
  ctx.font      = '11px sans-serif';
  ctx.fillText(upiId, W/2, iy + 22);

  if (hasAmt) {
    const atxt = '₹ ' + parseFloat(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    ctx.font = 'bold 12px sans-serif';
    const pw  = ctx.measureText(atxt).width + 28;
    const px  = W/2 - pw/2, py = iy + 48;
    ctx.fillStyle = primaryColor;
    roundRect(ctx, px, py, pw, 24, 12);
    ctx.fill();
    ctx.fillStyle    = onColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(atxt, W/2, py + 12);
    ctx.textBaseline = 'top';
  }

  // Footer
  ctx.fillStyle    = '#cccccc';
  ctx.font         = '9px sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.fillText('● UPI · Instant & Secure Payment', W/2, H - 8);

  return canvas.toBuffer('image/png');
}

// ---- Canvas helpers -------------------------------------------------

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
