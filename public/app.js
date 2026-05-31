/* ── QR Type definitions (client-side) ─────────────────────────── */
const QR_TYPES = {
  url: {
    label: 'Website', subtitle: 'Scan to Visit', centreLabelText: 'URL',
    logoName: 'url',
    defaultColor: '#1a73e8',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    getLabel: d => d.url || 'Website',
    buildQrString: d => (d.url || '').trim(),
    validate: d => !d.url ? 'URL is required' : null,
  },
  whatsapp: {
    label: 'WhatsApp', subtitle: 'Scan to Chat', centreLabelText: 'WA',
    logoName: 'whatsapp',
    defaultColor: '#25D366',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884"/></svg>',
    getLabel: d => d.waPhone || 'WhatsApp',
    buildQrString: d => {
      const p = (d.waPhone || '').replace(/\D/g, '');
      return 'https://wa.me/' + p + (d.waMessage ? '?text=' + encodeURIComponent(d.waMessage) : '');
    },
    validate: d => !d.waPhone ? 'Phone number is required' : null,
  },
  instagram: {
    label: 'Instagram', subtitle: 'Scan to Follow', centreLabelText: 'IG',
    logoName: 'instagram',
    defaultColor: '#E1306C',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    getLabel: d => d.igUsername || 'Instagram',
    buildQrString: d => 'https://instagram.com/' + (d.igUsername || '').replace(/^@/, '').trim(),
    validate: d => !d.igUsername ? 'Username is required' : null,
  },
  google_review: {
    label: 'Google Review', subtitle: 'Leave a Review', centreLabelText: 'G',
    logoName: 'google',
    defaultColor: '#4285F4',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
    getLabel: d => d.grPlaceId || 'Google Review',
    buildQrString: d => 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(d.grPlaceId || ''),
    validate: d => !d.grPlaceId ? 'Place ID is required' : null,
  },
  upi: {
    label: 'UPI Payment', subtitle: 'Scan to Pay', centreLabelText: 'UPI',
    defaultColor: '#7c3aed',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="5" x2="18" y2="5"/><line x1="6" y1="10" x2="18" y2="10"/><path d="M6 5h12a6 6 0 0 1 0 10H6"/><line x1="9" y1="20" x2="18" y2="10"/></svg>',
    getLabel: d => d.payeeName || d.upiId || 'UPI',
    buildQrString: d => {
      let s = 'upi://pay?pa=' + encodeURIComponent(d.upiId) + '&pn=' + encodeURIComponent(d.payeeName) + '&cu=INR';
      if (d.amount && parseFloat(d.amount) > 0) s += '&am=' + parseFloat(d.amount).toFixed(2);
      if (d.note) s += '&tn=' + encodeURIComponent(d.note);
      return s;
    },
    validate: d => !d.upiId ? 'UPI ID is required' : !d.payeeName ? 'Payee name is required' : null,
  },
  wifi: {
    label: 'WiFi', subtitle: 'Scan to Connect', centreLabelText: 'WiFi',
    logoName: 'wifi',
    defaultColor: '#0ea5e9',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M10.54 16.1a6 6 0 0 1 2.92 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
    getLabel: d => d.wifiSsid || 'WiFi',
    buildQrString: d => {
      const esc = s => (s || '').replace(/([\\;,"':])/g, '\\$1');
      return 'WIFI:T:' + (d.wifiSecurity || 'WPA') + ';S:' + esc(d.wifiSsid) + ';P:' + esc(d.wifiPassword) + ';H:' + !!d.wifiHidden + ';;';
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
  lastCard:          null,   // { canvas, layout } from the most recent successful build
  qrMatrix:          null,   // { size, data } base64 from the server, or null offline
  group3d:           null,   // THREE.Group cached from the last 3D build
};

/* ── Payment badge image loader (cached) ────────────────────────── */
const _badgeCache = {};
const BADGE_EXT = { gpay: 'png', phonepe: 'webp', paytm: 'png' };
function loadBadge(name) {
  if (_badgeCache[name]) return Promise.resolve(_badgeCache[name]);
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => { _badgeCache[name] = img; resolve(img); };
    img.onerror = () => resolve(null);   // null → fall back to canvas drawing
    const ext = BADGE_EXT[name] || 'svg';
    img.src = `/logos/${name}.${ext}?v=3`;
  });
}
// Kick off preload so they're ready by the time user clicks Generate
['gpay','phonepe','paytm','whatsapp','instagram','google','url','wifi'].forEach(loadBadge);

/* ── DOM helpers ────────────────────────────────────────────────── */
const $   = id => document.getElementById(id);
const val = id => { const el = $(id); return el ? el.value.trim() : ''; };
const checked = id => { const el = $(id); return el ? el.classList.contains('on') : false; };

/* ── Init ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  injectTypeIcons();
  selectMode('url', document.querySelector('[data-mode="url"]'));
  renderHistory();
  const a = $('btn3mf'), b = $('btnStlNew');
  if (a) a.addEventListener('click', download3MF);
  if (b) b.addEventListener('click', downloadSTLnew);
});

function injectTypeIcons() {
  /* icon values are hardcoded static SVG strings defined in QR_TYPES —
     they are never derived from user input, so DOMParser injection is safe. */
  Object.entries(QR_TYPES).forEach(([mode, def]) => {
    const el = document.getElementById('icon-' + mode);
    if (!el || !def.icon) return;
    const doc = new DOMParser().parseFromString(def.icon, 'image/svg+xml');
    const svg = doc.documentElement;
    if (svg && svg.tagName === 'svg') el.appendChild(svg);
  });
}

/* ── Mode switching ─────────────────────────────────────────────── */
function selectMode(mode, btn) {
  state.mode = mode;
  document.querySelectorAll('.mode-fields').forEach(el => el.classList.add('hidden'));
  const fieldsEl = $('fields-' + mode);
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
    tagline:      val('tagline'),
    wifiSsid:     val('wifiSsid'),
    wifiPassword: val('wifiPassword'),
    wifiSecurity: val('wifiSecurity'),
    wifiHidden:   $('wifiHidden') ? $('wifiHidden').checked : false,
    brandName:    val('brandName'),
    primaryColor: val('primaryColor'),
    qrColor:      val('qrColor'),
    bgColor:      val('bgColor') || '#ffffff',
    logoDataUrl:  state.logoDataUrl,
    logoType:     state.logoType,
    embedLogo:    $('embedLogo') ? $('embedLogo').checked : true,
    embedShape:   val('embedShape') || 'circle',
    embedScale:   (+val('r3dEmbed') || 22) / 100,
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
    centreLabelText:val('centreLabelText') || (QR_TYPES[state.mode] ? QR_TYPES[state.mode].centreLabelText : 'QR'),
    badgeWidth:     +val('badgeWidth')     || 30,
    badgeHeight:    +val('badgeHeight')    || 8,
  };
}

/* ── Generate ───────────────────────────────────────────────────── */
async function generate() {
  state.lastCard = null;
  state.qrMatrix = null;
  state.group3d = null;
  const data    = getFormData();
  const typeDef = QR_TYPES[data.mode];
  const err     = typeDef ? typeDef.validate(data) : null;
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
    state.qrMatrix = result.qrMatrix || null;
    state.scadContent = result.scadFile;
    state.isZip       = result.isZip;
    state.filename    = result.filename || 'qr';

    let displayPng = result.pngBase64;
    if (result.canvasMissing) {
      const card = await buildCardFromPlainQR('data:image/png;base64,' + result.pngBase64, data);
      displayPng = card.dataUrl.replace(/^data:image\/png;base64,/, '');
    } else {
      // Server rendered the full card PNG (canvas installed). Still build a
      // client-side card canvas so the 3D relief has pixels + layout
      // (buildFinalCard sets state.lastCard). Failure here only disables 3D.
      try {
        const qrCanvas = await makeQrCanvas(result.qrString, data.qrColor);
        await buildFinalCard(qrCanvas, data);
      } catch (e) { console.warn('3D card build skipped:', e.message); }
    }
    state.pngBase64 = displayPng;

    renderPreview('data:image/png;base64,' + displayPng);
    enableButtons();
    saveHistory(data, displayPng);
    showStatus('QR generated!', 'ok');
  } catch (e) {
    console.warn('API unavailable, using client-side mode:', e.message);
    await generateClientSide(data);
  } finally {
    $('generateBtn').disabled = false;
  }
}

async function buildCardFromPlainQR(qrDataUrl, data) {
  const qrImg = await new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = qrDataUrl;
  });
  return buildFinalCard(qrImg, data);
}

/* Render a crisp QR straight from the server module matrix in the chosen colour,
 * so the card's QR is byte-identical (data + 1-module quiet zone + colour) to the
 * QR the 3D relief rebuilds from the same matrix. */
function matrixToCanvas(m, color, modulePx, quiet) {
  modulePx = modulePx || 8; quiet = (quiet == null) ? 1 : quiet;
  const bytes = Uint8Array.from(atob(m.data), c => c.charCodeAt(0));
  const dim = (m.size + quiet*2) * modulePx;
  const cv = document.createElement('canvas'); cv.width = cv.height = dim;
  const x = cv.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, dim, dim);
  x.fillStyle = /^#[0-9a-fA-F]{6}$/.test(color||'') ? color : '#1a1a2e';
  for (let row = 0; row < m.size; row++) for (let col = 0; col < m.size; col++) {
    if (bytes[row*m.size + col] !== 1) continue;
    x.fillRect((quiet+col)*modulePx, (quiet+row)*modulePx, modulePx, modulePx);
  }
  return cv;
}

async function buildFinalCard(qrElement, data) {
  // Prefer a matrix-rendered QR in the chosen colour so the card matches the 3D.
  if (state.qrMatrix) {
    try { qrElement = matrixToCanvas(state.qrMatrix, data.qrColor); } catch (e) { /* keep passed qrElement */ }
  }
  let userLogoImg = null;
  if (data.logoDataUrl) {
    userLogoImg = await new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = data.logoDataUrl;
    });
  }
  // ONE universal layout for every QR type (the locked "bhuvis" format).
  // Service types pass their brand badge as the QR-centre fallback logo.
  const typeDef    = QR_TYPES[data.mode];
  const svcLogoImg = (data.mode !== 'upi' && typeDef && typeDef.logoName)
    ? await loadBadge(typeDef.logoName) : null;
  const result = await buildUpiCard(qrElement, userLogoImg, data, svcLogoImg);
  state.lastCard = { canvas: result.canvas, layout: result.layout };
  return result;
}

/* Render a plain QR code client-side (qrcodejs) and return its <canvas>.
 * Used by the offline fallback and to build the 3D card canvas when the
 * server returns a ready-made PNG. Throws on failure. */
async function makeQrCanvas(qrString, qrColor) {
  if (!window.QRCode) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
  }
  const tmpDiv = Object.assign(document.createElement('div'),
    { style: 'position:absolute;left:-9999px;top:-9999px;' });
  document.body.appendChild(tmpDiv);
  try {
    new QRCode(tmpDiv, {
      text: qrString, width: 300, height: 300,
      colorDark: qrColor || '#1a1a2e', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  } catch (ex) {
    document.body.removeChild(tmpDiv);
    throw new Error('QR generation failed');
  }
  await sleep(200);
  const qrCanvas = tmpDiv.querySelector('canvas');
  document.body.removeChild(tmpDiv);
  if (!qrCanvas) throw new Error('QR render failed');
  return qrCanvas;
}

/* ── Client-side fallback ───────────────────────────────────────── */
async function generateClientSide(data) {
  state.qrMatrix = null;
  state.group3d = null;
  const typeDef  = QR_TYPES[data.mode];
  const qrString = typeDef ? typeDef.buildQrString(data) : data.url || '';

  let qrCanvas;
  try {
    qrCanvas = await makeQrCanvas(qrString, data.qrColor);
  } catch (ex) {
    showStatus(ex.message + ' - check your inputs', 'err');
    return;
  }

  const card = await buildFinalCard(qrCanvas, data);
  const pngDataURL = card.dataUrl;

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
  while (disp.firstChild) disp.removeChild(disp.firstChild);
  const img = document.createElement('img');
  img.src   = src;
  img.title = 'Right-click then Save image as';
  disp.appendChild(img);
  $('saveHint').classList.remove('hidden');
}

function enableButtons() {
  $('btnScad').disabled = false;
  $('btnPng').disabled  = false;
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

async function download3MF() {
  if (!state.group3d) return;
  try {
    const blob = await window.QR3D.export3MF(state.group3d);
    downloadBlob(blob, safeName(getFormData()) + '_card.3mf');
    showStatus('3MF downloaded', 'ok');
  } catch (e) { showStatus('3MF export failed: ' + e.message, 'err'); }
}

function downloadSTLnew() {
  if (!state.group3d) return;
  try {
    const blob = window.QR3D.exportSTL(state.group3d);
    downloadBlob(blob, safeName(getFormData()) + '_card.stl');
    showStatus('STL downloaded', 'ok');
  } catch (e) { showStatus('STL export failed: ' + e.message, 'err'); }
}

/* ── History ────────────────────────────────────────────────────── */
const HISTORY_KEY = 'qrgen_history';

async function saveHistory(formData, pngBase64) {
  const thumb   = await downsamplePng(pngBase64, 80);
  const entries = getHistory();
  const typeDef = QR_TYPES[formData.mode];
  entries.unshift({
    timestamp: Date.now(),
    mode:      formData.mode,
    label:     typeDef ? typeDef.getLabel(formData) : formData.mode,
    formData,
    thumb,
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
  catch (ex) { return []; }
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

  /* Build history cards using safe DOM methods to avoid XSS */
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  entries.forEach(function(e, i) {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.addEventListener('click', function() { restoreHistory(i); });

    if (e.thumb) {
      const img = document.createElement('img');
      img.src       = 'data:image/png;base64,' + e.thumb;
      img.className = 'history-thumb';
      img.alt       = '';
      card.appendChild(img);
    }

    const info = document.createElement('div');
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
  fields.forEach(function(id) { const el = $(id); if (el && d[id] != null) el.value = d[id]; });

  if (d.primaryColor) { $('primaryColor').value = d.primaryColor; $('primaryColorText').value = d.primaryColor; }
  if (d.qrColor)      { $('qrColor').value      = d.qrColor;      $('qrColorText').value      = d.qrColor; }
  if ($('wifiSecurity')    && d.wifiSecurity    != null) $('wifiSecurity').value    = d.wifiSecurity;
  if ($('keyringPosition') && d.keyringPosition != null) $('keyringPosition').value = d.keyringPosition;

  [['t-rounded','v-rounded',d.roundedCorners],
   ['t-keyring', 'v-keyring', d.keyringHole],
   ['t-label',   'v-label',   d.centreLabel]].forEach(function(triple) {
    var btnId = triple[0], panelId = triple[1], on = triple[2];
    const btn = $(btnId); if (!btn) return;
    btn.classList.toggle('on', !!on);
    const panel = $(panelId); if (panel) panel.classList.toggle('hidden', !on);
  });

  generate();
}

function downsamplePng(base64, size) {
  return new Promise(resolve => {
    try {
      const img = new Image();
      const c   = document.createElement('canvas');
      c.width = size; c.height = size;
      img.onload = () => {
        c.getContext('2d').drawImage(img, 0, 0, size, size);
        resolve(c.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''));
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/png;base64,' + base64;
    } catch { resolve(null); }
  });
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

/* ── Per-mode content for the ONE universal "bhuvis" card layout ──── */
const CARD_CFG = {
  upi:           { action:'SCAN & PAY',     via:'VIA UPI',       badges:true,  pill:d=>d.upiId||'' },
  url:           { action:'SCAN TO VISIT',  via:'WEBSITE',       badges:false, pill:d=>{try{return new URL(d.url).hostname;}catch{return (d.url||'').slice(0,40);}} },
  whatsapp:      { action:'SCAN TO CHAT',   via:'VIA WHATSAPP',  badges:false, pill:d=>'+'+(d.waPhone||'').replace(/\D/g,'') },
  instagram:     { action:'SCAN TO FOLLOW', via:'ON INSTAGRAM',  badges:false, pill:d=>'@'+(d.igUsername||'').replace(/^@/,'').trim() },
  google_review: { action:'LEAVE A REVIEW', via:'ON GOOGLE',     badges:false, pill:()=>'★  Google Review' },
  wifi:          { action:'SCAN TO CONNECT',via:'WI-FI NETWORK', badges:false, pill:d=>d.wifiSsid||'Network' },
};

/* ── ONE universal branded print card (5"×11" @100px/inch, ECC-H) ──
 * The single locked "bhuvis" format used for EVERY QR type. Type-specific
 * content (action text, via text, info pill, payment badges) comes from
 * CARD_CFG; everything else is identical across types. `logoImg` is the top
 * emblem + QR-centre logo; `svcLogoImg` is a brand-badge fallback for the
 * QR centre on service types.
 */
async function buildUpiCard(qrEl, logoImg, data, svcLogoImg) {
  const typeDef   = QR_TYPES[data.mode] || {};
  const cfg       = CARD_CFG[data.mode] || CARD_CFG.url;
  const pc        = /^#[0-9a-fA-F]{6}$/.test(data.primaryColor||'') ? data.primaryColor : (typeDef.defaultColor || '#0d2e8a');
  const bgColor   = /^#[0-9a-fA-F]{6}$/.test(data.bgColor||'')      ? data.bgColor      : '#ffffff';
  const brandName = data.brandName || data.payeeName || (typeDef.getLabel ? typeDef.getLabel(data) : '') || 'Brand';
  const tagline   = (data.tagline  || '').trim();
  const centreImg = logoImg || svcLogoImg || null;   // QR-centre logo (badge fallback)

  // Derive readable colours for text/lines on top of bgColor
  function luma(hex) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return 0.299*r + 0.587*g + 0.114*b;
  }
  const bgDark   = luma(bgColor) < 160;
  // Primary text colour: use brand colour on light bg, white on dark bg
  const textCol  = bgDark ? '#ffffff' : pc;
  // Subtle colour for secondary text / divider lines
  const muteCol  = bgDark ? 'rgba(255,255,255,0.55)' : pc;
  const divAlpha = bgDark ? 0.25 : 0.13;

  /* Unified 5"×11" for ALL QR types (H=1100) at 100px/in × 2× retina.
   * Logo: 3.5" dominant (350px tall). QS=380 (3.8") QR. W=500 locked.
   * Output PNG: 1048×2248. When there's no top logo, the content block is
   * vertically balanced (see topPad below) so the taller card isn't top-heavy.
   */
  const W=500, H=1100, M=12, SC=2;
  const out = document.createElement('canvas');
  out.width=(W+M*2)*SC; out.height=(H+M*2)*SC;
  const ctx=out.getContext('2d');
  ctx.scale(SC,SC);
  const cx=M+W/2;

  function rr(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  }

  /* ── Payment app logo badge drawers ──────────────────────────────── */
  function drawGPayBadge(bx,by,bw,bh){
    // badge bg
    ctx.fillStyle='#ffffff'; ctx.strokeStyle='#dadce0'; ctx.lineWidth=0.8;
    rr(bx,by,bw,bh,6); ctx.fill(); rr(bx,by,bw,bh,6); ctx.stroke();
    const p=5, gs=bh-p*2, r=gs*0.40, gcx=bx+p+gs/2, gcy=by+bh/2, lwd=r*0.34;
    ctx.save(); ctx.lineWidth=lwd; ctx.lineCap='butt';
    const gap=-0.30; // break angle for crossbar (near 3-o'clock)
    // 4-colour Google G arcs (all counterclockwise = true)
    const arcs=[[gap,-Math.PI*0.55,'#4285F4'],[-Math.PI*0.55,Math.PI*0.65,'#EA4335'],
                [Math.PI*0.65,Math.PI*0.25,'#FBBC04'],[Math.PI*0.25,gap,'#34A853']];
    arcs.forEach(([s,e,c])=>{
      ctx.beginPath(); ctx.arc(gcx,gcy,r,s,e,true); ctx.strokeStyle=c; ctx.stroke();
    });
    // horizontal crossbar (blue) from centre to right edge, then short downstroke
    ctx.strokeStyle='#4285F4';
    ctx.beginPath(); ctx.moveTo(gcx,gcy); ctx.lineTo(gcx+r,gcy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gcx+r,gcy); ctx.lineTo(gcx+r,gcy+r*0.42); ctx.stroke();
    ctx.restore();
    // "Pay" label
    ctx.fillStyle='#202124'; ctx.font=`500 ${Math.round(bh*0.40)}px sans-serif`;
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText('Pay', gcx+r+lwd*0.5+4, gcy+1);
  }

  function drawPhonePeBadge(bx,by,bw,bh){
    ctx.fillStyle='#f4eefa'; ctx.strokeStyle='#c8aee8'; ctx.lineWidth=0.8;
    rr(bx,by,bw,bh,6); ctx.fill(); rr(bx,by,bw,bh,6); ctx.stroke();
    const p=5, r=(bh-p*2)*0.50, ccx=bx+p+r, ccy=by+bh/2;
    // Purple filled circle
    ctx.beginPath(); ctx.arc(ccx,ccy,r,0,Math.PI*2);
    ctx.fillStyle='#5f259f'; ctx.fill();
    // White stylised "Pe" mark inside
    ctx.fillStyle='#ffffff'; ctx.font=`900 ${Math.round(r*1.05)}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('Pe',ccx,ccy+1);
    // "PhonePe" text
    ctx.fillStyle='#5f259f'; ctx.font=`700 ${Math.round(bh*0.36)}px sans-serif`;
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText('PhonePe',ccx+r+5,ccy+1);
  }

  function drawPaytmBadge(bx,by,bw,bh){
    ctx.fillStyle='#e5f7fd'; ctx.strokeStyle='#80d8f0'; ctx.lineWidth=0.8;
    rr(bx,by,bw,bh,6); ctx.fill(); rr(bx,by,bw,bh,6); ctx.stroke();
    const fs = Math.round(bh*0.43);
    ctx.font=`900 ${fs}px sans-serif`; ctx.textBaseline='middle'; ctx.textAlign='left';
    const payW = ctx.measureText('Pay').width;
    const tmW  = ctx.measureText('tm').width;
    const tx   = bx + (bw - payW - tmW) / 2;
    ctx.fillStyle='#002970'; ctx.fillText('Pay', tx, by+bh/2+1);
    ctx.fillStyle='#00BAF2'; ctx.fillText('tm', tx + payW, by+bh/2+1);
  }

  /* ── Trust-signal icon drawers (footer) ─────────────────────────── */
  function iconShield(ix,iy,is,col){
    ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=1.6; ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(ix+is*.50,iy);
    ctx.lineTo(ix+is*.95,iy+is*.26); ctx.lineTo(ix+is*.95,iy+is*.58);
    ctx.bezierCurveTo(ix+is*.95,iy+is*.82,ix+is*.50,iy+is,ix+is*.50,iy+is);
    ctx.bezierCurveTo(ix+is*.05,iy+is*.82,ix+is*.05,iy+is*.58,ix+is*.05,iy+is*.58);
    ctx.lineTo(ix+is*.05,iy+is*.26); ctx.closePath(); ctx.stroke();
    // checkmark
    ctx.beginPath();
    ctx.moveTo(ix+is*.30,iy+is*.52); ctx.lineTo(ix+is*.46,iy+is*.68); ctx.lineTo(ix+is*.72,iy+is*.38);
    ctx.stroke(); ctx.restore();
  }
  function iconBolt(ix,iy,is,col){
    ctx.save(); ctx.fillStyle=col;
    ctx.beginPath();
    ctx.moveTo(ix+is*.60,iy);    ctx.lineTo(ix+is*.26,iy+is*.50);
    ctx.lineTo(ix+is*.48,iy+is*.50); ctx.lineTo(ix+is*.38,iy+is);
    ctx.lineTo(ix+is*.74,iy+is*.50); ctx.lineTo(ix+is*.52,iy+is*.50);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function iconThumb(ix,iy,is,col){
    ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=1.6; ctx.lineJoin='round'; ctx.lineCap='round';
    // thumb up outline
    ctx.beginPath();
    ctx.moveTo(ix+is*.10,iy+is*.46); ctx.lineTo(ix+is*.10,iy+is*.96);
    ctx.lineTo(ix+is*.38,iy+is*.96); ctx.lineTo(ix+is*.38,iy+is*.46);
    // thumb digit curves up
    ctx.lineTo(ix+is*.38,iy+is*.30);
    ctx.arc(ix+is*.55,iy+is*.18,is*.20, Math.PI, 0, false);
    ctx.lineTo(ix+is*.75,iy+is*.46);
    ctx.lineTo(ix+is*.94,iy+is*.46); ctx.lineTo(ix+is*.94,iy+is*.92);
    ctx.lineTo(ix+is*.38,iy+is*.92);
    ctx.stroke();
    // knuckle lines
    ctx.globalAlpha=0.5;
    [.60,.72,.84].forEach(t=>{
      ctx.beginPath();ctx.moveTo(ix+is*.38,iy+is*t);ctx.lineTo(ix+is*.94,iy+is*t);ctx.stroke();
    });
    ctx.restore();
  }

  // Card: shadow then background fill
  ctx.shadowColor='rgba(0,0,0,0.22)'; ctx.shadowBlur=28; ctx.shadowOffsetY=8;
  ctx.fillStyle=bgColor; rr(M,M,W,H,20); ctx.fill();
  ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  ctx.fillStyle=bgColor; rr(M,M,W,H,20); ctx.fill();
  ctx.save(); rr(M,M,W,H,20); ctx.clip();

  // Vertically balance content when there's no dominant top logo, so the
  // unified 5×11 card isn't top-heavy (footer stays bottom-anchored).
  let y = M+22 + (logoImg ? 0 : 200);

  // ── LOGO — dominant 3.5" (350px) block ───────────────────────────
  if (logoImg) {
    const maxH=350, maxW=W*0.82;   // 350px = 3.5" at 100px/in
    const sc=Math.min(maxH/logoImg.naturalHeight, maxW/logoImg.naturalWidth);
    const lw=Math.round(logoImg.naturalWidth*sc), lh=Math.round(logoImg.naturalHeight*sc);
    ctx.drawImage(logoImg, cx-lw/2, y, lw, lh);
    y += lh+18;
  }

  // ── BRAND NAME — one line if it fits at a readable size, else two lines ──
  ctx.fillStyle=textCol; ctx.textAlign='center'; ctx.textBaseline='top';
  {
    const BN = brandName.toUpperCase(), maxW = W-32;
    let fs = 32; ctx.font=`900 ${fs}px sans-serif`;
    while(ctx.measureText(BN).width>maxW && fs>20){ fs--; ctx.font=`900 ${fs}px sans-serif`; }
    if (ctx.measureText(BN).width <= maxW) {
      ctx.fillText(BN, cx, y); y += fs+8;
    } else {
      // wrap into two lines at the space nearest the middle
      const words = BN.split(/\s+/);
      let best = Math.max(1, Math.round(words.length/2)), bestDiff = Infinity;
      for (let i=1; i<words.length; i++) {
        const d = Math.abs(words.slice(0,i).join(' ').length - words.slice(i).join(' ').length);
        if (d < bestDiff) { bestDiff = d; best = i; }
      }
      const line1 = words.slice(0,best).join(' '), line2 = words.slice(best).join(' ') || '';
      while((ctx.measureText(line1).width>maxW || ctx.measureText(line2).width>maxW) && fs>14){ fs--; ctx.font=`900 ${fs}px sans-serif`; }
      ctx.fillText(line1, cx, y); y += fs+4;
      if (line2) { ctx.fillText(line2, cx, y); y += fs+4; }
      y += 4;
    }
  }

  // ── TAGLINE with flanking lines, or thin divider ──────────────────
  if (tagline) {
    const tl=tagline.toUpperCase();
    ctx.font='12px sans-serif';
    const tW=ctx.measureText(tl).width;
    const ll=Math.max(0,(W-tW-48)/2-6);
    ctx.globalAlpha=divAlpha*2; ctx.strokeStyle=textCol; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(M+16,y+8); ctx.lineTo(M+16+ll,y+8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+tW/2+6,y+8); ctx.lineTo(cx+tW/2+6+ll,y+8); ctx.stroke();
    ctx.globalAlpha=0.7; ctx.fillStyle=textCol;
    ctx.fillText(tl, cx, y+1);
    ctx.globalAlpha=1;
  } else {
    ctx.strokeStyle=textCol; ctx.lineWidth=1; ctx.globalAlpha=divAlpha;
    ctx.beginPath(); ctx.moveTo(M+16,y+8); ctx.lineTo(M+W-16,y+8); ctx.stroke();
    ctx.globalAlpha=1;
  }
  y += 20;

  // ── SCAN & PAY with flanking lines ───────────────────────────────
  y += 12;
  ctx.font='bold 16px sans-serif'; ctx.fillStyle=textCol; ctx.textBaseline='top';
  const spTxt=cfg.action, spW=ctx.measureText(spTxt).width;
  const dl=Math.max(0,(W-spW-48)/2-6);
  ctx.strokeStyle=textCol; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(M+16,y+10); ctx.lineTo(M+16+dl,y+10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+spW/2+6,y+10); ctx.lineTo(cx+spW/2+6+dl,y+10); ctx.stroke();
  ctx.fillText(spTxt, cx, y);
  y += 22;

  // ── VIA UPI ───────────────────────────────────────────────────────
  ctx.font='12px sans-serif'; ctx.fillStyle=muteCol; ctx.globalAlpha=1;
  ctx.fillText(cfg.via, cx, y);
  y += 16;

  // ── QR BOX — fixed 380 for ALL cards: locked, consistent QR dimension ──
  const QS=380, qbPad=10, qbSz=QS+qbPad*2;
  const qbX=M+(W-qbSz)/2, qbY=y+8;
  // Clean white rounded field (quiet zone) — no coloured frame, matches reference.
  ctx.fillStyle='#ffffff'; rr(qbX,qbY,qbSz,qbSz,14); ctx.fill();
  ctx.drawImage(qrEl, qbX+qbPad, qbY+qbPad, QS, QS);

  // Device-pixel rect of the QR field (canvas is scaled by SC), for the 3D relief.
  const qrRect = {
    x: (qbX + qbPad) * SC, y: (qbY + qbPad) * SC,
    w: QS * SC, h: QS * SC,
  };

  // Embedded centre logo (toggle + shape). Reserve a backing in the QR centre
  // and draw the logo if uploaded; if not, leave it blank. Shape = circle|square.
  let logoRect = null;
  const logoShape = (data.embedShape === 'square') ? 'rect' : 'circle';
  if (data.embedLogo !== false) {
    const os=Math.round(QS*(data.embedScale||0.22));
    const ox=qbX+qbPad+(QS-os)/2, oy=qbY+qbPad+(QS-os)/2;
    const backing = () => { // backing/outline path (shape-aware)
      if (logoShape === 'circle') { ctx.beginPath(); ctx.arc(ox+os/2, oy+os/2, (os+10)/2, 0, Math.PI*2); }
      else rr(ox-5, oy-5, os+10, os+10, 7);
    };
    // Dark backing on dark cards (emblem on black, like the reference); the
    // outline still delineates it. On light cards this stays light.
    ctx.fillStyle=bgColor; backing(); ctx.fill();
    if (centreImg) {
      ctx.save();
      if (logoShape === 'circle') { ctx.beginPath(); ctx.arc(ox+os/2, oy+os/2, os/2, 0, Math.PI*2); ctx.clip(); }
      else { rr(ox, oy, os, os, 5); ctx.clip(); }
      ctx.drawImage(centreImg, ox, oy, os, os); ctx.restore();
    }
    // Outline around the embed area (delineates the logo zone, esp. when empty).
    ctx.strokeStyle=pc; ctx.lineWidth=2.5; backing(); ctx.stroke();
    // Device-pixel rect of the reserved logo area, for the 3D embedded-logo relief.
    logoRect = { x: (ox-5)*SC, y: (oy-5)*SC, w: (os+10)*SC, h: (os+10)*SC };
  }
  y = qbY+qbSz+14;

  // ── INFO PILL (UPI id / phone / @user / hostname / SSID) ──────────
  const pillH=36, pillW=W-60;
  ctx.fillStyle=pc; rr(M+30,y,pillW,pillH,pillH/2); ctx.fill();
  // Dark text on a light/gold pill, white on a dark pill (matches reference).
  ctx.fillStyle = luma(pc) > 150 ? '#1a1a1a' : '#ffffff';
  ctx.font='900 20px monospace'; ctx.textBaseline='middle';
  const pillFull = (cfg.pill(data) || '').toString();
  let uid=pillFull;
  while(ctx.measureText(uid).width>pillW-28&&uid.length>6) uid=uid.slice(0,-1);
  if(uid!==pillFull) uid+='…';
  ctx.fillText(uid, cx, y+pillH/2);
  y += pillH+10;

  // ── Payment apps (UPI only) ───────────────────────────────────────
  if (cfg.badges) {
  ctx.fillStyle=muteCol; ctx.font='bold 10px sans-serif'; ctx.textBaseline='top';
  ctx.fillText('ALL UPI APPS ACCEPTED', cx, y);
  y += 16;

  // ── PAYMENT APP LOGOS — real brand images in pill containers ────
  {
    const [gpayImg, phonepeImg, paytmImg] = await Promise.all([
      loadBadge('gpay'), loadBadge('phonepe'), loadBadge('paytm'),
    ]);

    const bh = 40, gap = 12, pad = 6;
    const logoH = bh - pad * 2;

    function badgeAr(img, fallbackAr) {
      if (!img) return fallbackAr;
      const nw = img.naturalWidth, nh = img.naturalHeight;
      return (nw && nh) ? nw / nh : fallbackAr;
    }

    const badges = [
      { img: gpayImg,    ar: badgeAr(gpayImg,    752/400), fallback: drawGPayBadge    },
      { img: phonepeImg, ar: badgeAr(phonepeImg,  1.5),    fallback: drawPhonePeBadge },
      { img: paytmImg,   ar: badgeAr(paytmImg,    1.5),    fallback: drawPaytmBadge   },
    ];

    // Equal-width pills: find the widest logo, use that for all
    const logoWs  = badges.map(b => Math.round(logoH * b.ar));
    const maxLogoW = Math.max(...logoWs);
    const pillW   = maxLogoW + pad * 2;          // same for every badge
    const totalBW = pillW * badges.length + gap * (badges.length - 1);
    let bx = cx - totalBW / 2;

    badges.forEach((b, i) => {
      if (b.img) {
        ctx.save();
        ctx.shadowColor   = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur    = 6;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#ffffff';
        rr(bx, y, pillW, bh, bh / 2);
        ctx.fill();
        ctx.restore();
        // Centre logo horizontally inside the fixed-width pill
        const logoW = logoWs[i];
        const lx    = bx + (pillW - logoW) / 2;
        ctx.drawImage(b.img, lx, y + pad, logoW, logoH);
      } else {
        b.fallback(bx, y, pillW, bh);
      }
      bx += pillW + gap;
    });
    y += bh;
  }
  } // end cfg.badges (UPI only)

  // ── FOOTER ────────────────────────────────────────────────────────
  const footH=56, footY=M+H-footH;
  ctx.fillStyle=pc;
  ctx.beginPath();
  ctx.moveTo(M,footY); ctx.lineTo(M+W,footY);
  ctx.lineTo(M+W,M+H-20); ctx.quadraticCurveTo(M+W,M+H,M+W-20,M+H);
  ctx.lineTo(M+20,M+H); ctx.quadraticCurveTo(M,M+H,M,M+H-20);
  ctx.closePath(); ctx.fill();

  // Trust signals: icon + label, separated by |
  {
    const fcy = footY+footH/2, icSz=footH*0.40, icY=fcy-icSz/2;
    const trustFont=`bold 11px sans-serif`;
    ctx.font=trustFont;
    const items=[
      {label:'SECURE', draw:iconShield},
      {label:'FAST',   draw:iconBolt},
      {label:'RELIABLE',draw:iconThumb},
    ];
    const sep='  |  ';
    const sepW=ctx.measureText(sep).width;
    const itemWidths=items.map(it=>icSz+4+ctx.measureText(it.label).width);
    const totalTW=itemWidths.reduce((s,w)=>s+w,0)+sepW*(items.length-1);
    let tx=cx-totalTW/2;
    // Dark trust text/icons on a light/gold footer, white on a dark footer.
    const footCol = luma(pc) > 150 ? '#1a1a1a' : '#ffffff';
    ctx.fillStyle=footCol; ctx.textBaseline='middle';
    items.forEach((it,i)=>{
      it.draw(tx,icY,icSz,footCol);
      ctx.font=trustFont; ctx.fillStyle=footCol;
      ctx.textAlign='left';
      ctx.fillText(it.label, tx+icSz+4, fcy);
      tx+=itemWidths[i];
      if(i<items.length-1){
        ctx.globalAlpha=0.45; ctx.fillText(sep,tx,fcy); ctx.globalAlpha=1;
        tx+=sepW;
      }
    });
  }

  ctx.restore();
  const qrCol = /^#[0-9a-fA-F]{6}$/.test(data.qrColor||'') ? data.qrColor : '#1a1a2e';
  return {
    dataUrl: out.toDataURL('image/png'),
    canvas: out,
    layout: { qrRect, logoRect, logoShape, qrColor: qrCol,
              paletteHints: [pc, bgColor, '#ffffff', qrCol] },
  };
}

/* ── Client-side card renderer (standalone fallback) ────────────── */
function buildCardCanvas(qrCanvas, data) {
  const primaryColor = data.primaryColor || '#1a73e8';
  const typeDef  = QR_TYPES[data.mode];
  const brandName = data.brandName || (typeDef ? typeDef.getLabel(data) : 'QR');
  const subtitle  = typeDef ? typeDef.subtitle : 'Scan QR Code';
  const QS=280, W=380, HH=66, SC=2, H=HH+QS+95, M=12;
  const out = document.createElement('canvas');
  out.width = (W+M*2)*SC; out.height = (H+M*2)*SC;
  const ctx = out.getContext('2d');
  ctx.scale(SC, SC);
  const lum = function(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return 128;
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return .299*r+.587*g+.114*b;
  };
  const onColor = lum(primaryColor) > 150 ? '#1a1a2e' : '#ffffff';
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
  function rrTop(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
  ctx.shadowColor='rgba(0,0,0,0.18)';ctx.shadowBlur=20;ctx.shadowOffsetY=6;
  ctx.fillStyle='#ffffff';rr(M,M,W,H,14);ctx.fill();
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.fillStyle=primaryColor;rrTop(M,M,W,HH,14);ctx.fill();
  const AV=38,ax=M+14,ay=M+(HH-AV)/2;
  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.beginPath();ctx.arc(ax+AV/2,ay+AV/2,AV/2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=onColor;ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText((brandName||'?').charAt(0).toUpperCase(),ax+AV/2,ay+AV/2);
  ctx.fillStyle=onColor;ctx.font='bold 13px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillText(brandName,ax+AV+10,M+16);
  ctx.fillStyle=onColor+'bb';ctx.font='10px sans-serif';ctx.fillText(subtitle,ax+AV+10,M+33);
  const qx=M+(W-QS)/2,qy=M+HH+12;
  ctx.fillStyle='#f0f0f4';rr(qx-5,qy-5,QS+10,QS+10,7);ctx.fill();
  ctx.drawImage(qrCanvas,qx,qy,QS,QS);
  ctx.fillStyle='#1a1a2e';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText(brandName,M+W/2,qy+QS+14);
  ctx.fillStyle='#ccc';ctx.font='9px sans-serif';ctx.textBaseline='bottom';
  ctx.fillText('QR Generator',M+W/2,M+H-6);
  return out.toDataURL('image/png');
}

/* ── Client-side SCAD builder (standalone — needs library alongside) */
function buildSCADClient(qrString, data) {
  const scadStr = s => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const baseLength    = data.baseLength    || 90;
  const baseWidth     = data.baseWidth     || 90;
  const baseThickness = data.baseThickness || 2;
  const qrSize        = data.qrSize        || 70;
  const qrRaise       = data.qrRaise       || 0.8;
  const roundedCorners   = data.roundedCorners   || false;
  const cornerRadius     = data.cornerRadius     || 4;
  const keyringHole      = data.keyringHole      || false;
  const holeDiameter     = data.holeDiameter     || 5;
  const tabDiameter      = data.tabDiameter      || 12;
  const keyringPosition  = data.keyringPosition  || 0;
  const centreLabel      = data.centreLabel !== undefined ? data.centreLabel : true;
  const centreLabelText  = data.centreLabelText  || 'QR';
  const badgeWidth       = data.badgeWidth       || 30;
  const badgeHeight      = data.badgeHeight      || 8;
  const textSize = Math.round(badgeHeight*0.55*10)/10;
  return '// QR Generator - client-side SCAD (standalone mode)\n' +
    '// NOTE: Requires scadqr_library.scad in the same folder.\n' +
    '// Download from: https://github.com/xypwn/scadqr\n' +
    '// Use the server to get a self-contained file.\n\n' +
    'include <scadqr_library.scad>\n\n' +
    'qr_string="' + scadStr(qrString) + '";\n' +
    'base_length=' + baseLength + ';base_width=' + baseWidth + ';base_thickness=' + baseThickness + ';\n' +
    'qr_size=' + qrSize + ';qr_block_height=' + qrRaise + ';\n' +
    'apply_round_corner=' + roundedCorners + ';round_corner_radius=' + cornerRadius + ';\n' +
    'add_keyring_hole=' + keyringHole + ';keyring_hole_diameter=' + holeDiameter + ';\n' +
    'keyring_tab_diameter=' + tabDiameter + ';keyring_position=' + keyringPosition + ';\n' +
    'show_centre_label=' + centreLabel + ';centre_label_text="' + scadStr(centreLabelText) + '";\n' +
    'centre_badge_width=' + badgeWidth + ';centre_badge_height=' + badgeHeight + ';\n' +
    'centre_badge_thickness=0.4;centre_text_height=0.6;centre_text_size=' + textSize + ';\n' +
    'base_color=[1,1,1];qr_color=[0,0,0];label_color=[0,0,0];\n\n' +
    'module rounded_rect_2d(l,w,r){if(r<=0){square([l,w]);}else{hull(){translate([r,r])circle(r=r,$fn=64);translate([l-r,r])circle(r=r,$fn=64);translate([l-r,w-r])circle(r=r,$fn=64);translate([r,w-r])circle(r=r,$fn=64);}}}\n' +
    'module rounded_plate(l,w,t,r){linear_extrude(height=t)rounded_rect_2d(l,w,r);}\n' +
    'module qr_plate(){actual_l=max(base_length,qr_size+8);actual_w=max(base_width,qr_size+8);qr_x=(actual_l-qr_size)/2;qr_y=(actual_w-qr_size)/2;cr=apply_round_corner?min(round_corner_radius,actual_l/2,actual_w/2):0;color([1,1,1])rounded_plate(actual_l,actual_w,base_thickness,cr);color([0,0,0])translate([qr_x,qr_y,base_thickness])qr(message=qr_string,error_correction="H",width=qr_size,height=qr_size,thickness=qr_block_height,center=false,mask_pattern=0,encoding="UTF-8");}\n' +
    'qr_plate();';
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
  if (name === '3d') show3DTab();
  else if (window.QR3D) window.QR3D.disposePreview();
}

function show3DTab() {
  const msg = $('msg3d');
  if (!window.QR3D) { msg.textContent = '3D module still loading — try again in a moment.'; return; }
  if (!state.lastCard || !state.qrMatrix) {
    msg.textContent = state.qrMatrix ? 'Generate a card first.'
      : '3D needs the server (offline mode unsupported in this version).';
    $('btn3mf').disabled = true; $('btnStlNew').disabled = true;
    return;
  }
  try {
    if (!state.group3d) {
      const matrix = {
        size: state.qrMatrix.size,
        data: Uint8Array.from(atob(state.qrMatrix.data), c => c.charCodeAt(0)),
      };
      state.group3d = window.QR3D.build(state.lastCard.canvas, state.lastCard.layout, matrix, relief3dOpts());
    }
    window.QR3D.mountPreview(state.group3d, $('viewer3d'));
    $('btn3mf').disabled = false; $('btnStlNew').disabled = false;
    msg.textContent = '';
  } catch (e) {
    if (e.message === 'NO_WEBGL') {
      msg.textContent = 'No WebGL on this device — preview unavailable, but downloads still work.';
      if (state.group3d) { $('btn3mf').disabled = false; $('btnStlNew').disabled = false; }
    } else {
      msg.textContent = '3D build failed: ' + e.message;
    }
  }
}

/* Read the 3D Relief sliders into qr3d.build() options. */
function relief3dOpts() {
  const num = (id, d) => { const el = $(id); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? d : v; };
  const o = {
    baseThickness: num('r3dThickness', 2),
    layerHeight:   num('r3dRelief', 0.8),
    colors:        Math.round(num('r3dColors', 4)),
  };
  const size = num('r3dSize', 0);
  if (size > 0) o.longEdgeMM = size;   // 0 = auto (real card size)
  return o;
}

/* Rebuild the cached 3D model from the current card + sliders and re-mount. */
function rebuild3D() {
  if (!window.QR3D || !state.lastCard || !state.qrMatrix) return;
  const panel = $('tab-3d');
  if (!panel || panel.classList.contains('hidden')) return; // only when 3D tab is visible
  const matrix = {
    size: state.qrMatrix.size,
    data: Uint8Array.from(atob(state.qrMatrix.data), c => c.charCodeAt(0)),
  };
  try {
    state.group3d = window.QR3D.build(state.lastCard.canvas, state.lastCard.layout, matrix, relief3dOpts());
    window.QR3D.mountPreview(state.group3d, $('viewer3d'));
    $('btn3mf').disabled = false; $('btnStlNew').disabled = false;
  } catch (e) {
    if (e.message !== 'NO_WEBGL') $('msg3d').textContent = '3D build failed: ' + e.message;
  }
}

let _r3dTimer = null;
function onRelief3dInput() {
  // live value labels
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('r3dThicknessV', (+$('r3dThickness').value).toFixed(1));
  set('r3dReliefV',    (+$('r3dRelief').value).toFixed(1));
  set('r3dColorsV',    $('r3dColors').value);
  const sz = +$('r3dSize').value;
  set('r3dSizeV', sz > 0 ? sz + ' mm' : 'auto');
  // invalidate cache + debounce a live rebuild
  state.group3d = null;
  clearTimeout(_r3dTimer);
  _r3dTimer = setTimeout(rebuild3D, 140);
}

let _embedTimer = null;
function onEmbedSizeInput() {
  $('r3dEmbedV').textContent = $('r3dEmbed').value;
  // embed size lives in the card render → regenerate the card (debounced)
  clearTimeout(_embedTimer);
  _embedTimer = setTimeout(() => generate(), 300);
}

function showStatus(msg, type) {
  const el     = $('statusMsg');
  el.textContent = msg;
  el.className   = 'status-msg show ' + (type || 'ok');
  setTimeout(function() { el.classList.remove('show'); }, 5000);
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

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function loadScript(src) {
  return new Promise(function(resolve, reject) {
    const s   = document.createElement('script');
    s.src     = src;
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') generate();
});
