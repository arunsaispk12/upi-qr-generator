/* Manual verification harness: drives the real app in headless Chrome via CDP
 * (no puppeteer needed — Node 22 global WebSocket) and saves the generated
 * cards so the QR-centre logo fit can be inspected.
 *   node scripts/centre-logo-cdp.mjs   (expects app on :3000 and Chrome on :9223)
 */
import fs from 'node:fs';

const PORT = 9223;
const http = async (path, method = 'GET') =>
  (await fetch(`http://127.0.0.1:${PORT}${path}`, { method })).json();

// Wait for Chrome's debug endpoint
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try { await http('/json/version'); up = true; }
  catch { await new Promise(r => setTimeout(r, 250)); }
}
if (!up) { console.error('Chrome debug port not reachable'); process.exit(1); }

const page = await http('/json/new?url=http://localhost:3000', 'PUT');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let seq = 0; const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++seq; pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: 'http://localhost:3000' });
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails)
    throw new Error('page error: ' + JSON.stringify(r.result.exceptionDetails, null, 2).slice(0, 2000));
  return r.result.result.value;
};

// Wait for app.js globals
let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  ready = await evalJs(`typeof generate === 'function' && typeof buildUpiCard === 'function'`);
  if (!ready) await new Promise(r => setTimeout(r, 250));
}
if (!ready) { console.error('app never loaded:', await evalJs('location.href')); process.exit(1); }

// ── Test 1: UPI card with a synthetic padded logo (circular gold emblem on a
// black square with heavy padding — same shape of problem as the Bhuvi's file).
const upiPng = await evalJs(`(async () => {
  const c = document.createElement('canvas'); c.width = c.height = 400;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 400, 400);
  x.fillStyle = '#d4af37'; x.beginPath(); x.arc(200, 200, 120, 0, Math.PI*2); x.fill();
  x.fillStyle = '#000';    x.beginPath(); x.arc(200, 200, 104, 0, Math.PI*2); x.fill();
  x.strokeStyle = '#d4af37'; x.lineWidth = 5;
  x.beginPath(); x.arc(200, 200, 92, 0, Math.PI*2); x.stroke();
  x.fillStyle = '#d4af37'; x.font = 'bold 40px serif';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText("B's", 200, 200);
  state.logoDataUrl = c.toDataURL('image/png'); state.logoType = 'png';
  selectMode('upi', null);
  document.getElementById('payeeName').value = 'Test Shop';
  document.getElementById('upiId').value = 'test@upi';
  await generate();
  return state.pngBase64;
})()`);
fs.writeFileSync('scripts/out-upi.png', Buffer.from(upiPng, 'base64'));

// ── Test 2: Instagram service card (no upload → instagram badge in centre).
const igPng = await evalJs(`(async () => {
  clearLogo();
  selectMode('instagram', null);
  document.getElementById('igUsername').value = 'bhuvis_makeup_artist_salem';
  await generate();
  return state.pngBase64;
})()`);
fs.writeFileSync('scripts/out-instagram.png', Buffer.from(igPng, 'base64'));

console.log('saved scripts/out-upi.png and scripts/out-instagram.png');
ws.close();
