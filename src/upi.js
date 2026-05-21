/**
 * upi.js — UPI payment string builder
 * Builds valid upi://pay?... strings for QR encoding
 */

/**
 * Build a UPI deep-link string.
 * @param {Object} opts
 * @param {string} opts.upiId     - UPI VPA e.g. name@upi
 * @param {string} opts.payeeName - Display name
 * @param {string} [opts.amount]  - Amount in INR (optional)
 * @param {string} [opts.note]    - Transaction note (optional)
 * @returns {string}
 */
function buildUPIString({ upiId, payeeName, amount, note }) {
  if (!upiId)     throw new Error('upiId is required');
  if (!payeeName) throw new Error('payeeName is required');

  let str = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&cu=INR`;
  if (amount && parseFloat(amount) > 0) {
    str += `&am=${parseFloat(amount).toFixed(2)}`;
  }
  if (note && note.trim()) {
    str += `&tn=${encodeURIComponent(note.trim())}`;
  }
  return str;
}

/**
 * Validate a UPI ID format.
 * @param {string} upiId
 * @returns {boolean}
 */
function validateUPIId(upiId) {
  // Standard VPA format: localpart@provider
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId);
}

module.exports = { buildUPIString, validateUPIId };
