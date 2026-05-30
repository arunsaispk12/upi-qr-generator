const QRCode = require('qrcode');

/**
 * Build the QR module matrix for a string at error-correction level H.
 * Returns { size, data } where data is base64 of a size*size byte array,
 * each byte 1 (dark module) or 0 (light).
 *
 * Throws if `qrString` is empty/missing, or if the underlying `qrcode` lib
 * cannot encode it (e.g. data too large). Callers outside an HTTP try/catch
 * should handle these.
 */
function getQrMatrix(qrString) {
  if (!qrString) throw new Error('getQrMatrix: qrString is required');
  const qr = QRCode.create(qrString, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const src = qr.modules.data; // Uint8Array, 1 = dark
  const out = Buffer.alloc(size * size);
  for (let i = 0; i < out.length; i++) out[i] = src[i] ? 1 : 0;
  return { size, data: out.toString('base64') };
}

module.exports = { getQrMatrix };
