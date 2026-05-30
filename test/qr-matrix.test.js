const test = require('node:test');
const assert = require('node:assert');
const { getQrMatrix } = require('../src/qr-matrix');

test('getQrMatrix returns size and base64 data of length size*size', () => {
  const m = getQrMatrix('upi://pay?pa=test@upi&pn=Test');
  assert.ok(m.size >= 21 && m.size % 2 === 1, 'odd module size >= 21');
  const bytes = Buffer.from(m.data, 'base64');
  assert.strictEqual(bytes.length, m.size * m.size, 'one byte per module');
});

test('getQrMatrix dark-module bytes are 0/1 and there is at least one dark', () => {
  const m = getQrMatrix('https://example.com');
  const bytes = Buffer.from(m.data, 'base64');
  let dark = 0;
  for (const b of bytes) { assert.ok(b === 0 || b === 1); if (b === 1) dark++; }
  assert.ok(dark > 0, 'matrix has dark modules');
});

test('getQrMatrix throws on empty input', () => {
  assert.throws(() => getQrMatrix(''), /required|input text/i);
});
