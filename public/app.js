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
      return 'https://wa.me/' + p + (d.waMessage ? '?text=' + encodeURIComponent(d.waMessage) : '');
    },
    validate: d => !d.waPhone ? 'Phone number is required' : null,
  },
  instagram: {
    label: 'Instagram', subtitle: 'Scan to Follow', centreLabelText: 'IG',
    defaultColor: '#E1306C',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    getLabel: d => d.igUsername || 'Instagram',
    buildQrString: d => 'https://instagram.com/' + (d.igUsername || '').replace(/^@/, '').trim(),
    validate: d => !d.igUsername ? 'Username is required' : null,
  },
  google_review: {
    label: 'Google Review', subtitle: 'Leave a Review', centreLabelText: 'G',
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
  openscadAvailable: false,
};

/* ── Payment badge image loader (cached) ────────────────────────── */
const _badgeCache = {};
function loadBadge(name) {
  if (_badgeCache[name]) return Promise.resolve(_badgeCache[name]);
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => { _badgeCache[name] = img; resolve(img); };
    img.onerror = () => resolve(null);   // null → fall back to canvas drawing
    img.src = `/logos/${name}.svg`;
  });
}
// Kick off preload so they're ready by the time user clicks Generate
['gpay','phonepe','paytm'].forEach(loadBadge);

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
    state.scadContent = result.scadFile;
    state.isZip       = result.isZip;
    state.filename    = result.filename || 'qr';

    let displayPng = result.pngBase64;
    if (result.canvasMissing) {
      const cardDataUrl = await buildCardFromPlainQR('data:image/png;base64,' + result.pngBase64, data);
      displayPng = cardDataUrl.replace(/^data:image\/png;base64,/, '');
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

async function buildFinalCard(qrElement, data) {
  if (data.mode === 'upi') {
    let logoImg = null;
    if (data.logoDataUrl) {
      logoImg = await new Promise(resolve => {
        const img = new Image();
        img.onload  = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = data.logoDataUrl;
      });
    }
    return await buildUpiCard(qrElement, logoImg, data);
  }
  return buildCardCanvas(qrElement, data);
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
  } catch (ex) {
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

  const pngDataURL = await buildFinalCard(qrCanvas, data);
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

/* ── UPI professional print card (5"×7" @100px/inch, ECC-H) ─────── */
/*
 * W=500 (5"), H=700 with logo (7") / H=630 no logo (6.3")
 * QS=380 = 3.8" QR → 15mm quiet zone: (500-380)/2 = 60px = 15.2mm
 * Logo overlay: 22% of QS = 84px, circular clip
 * Layout: ~20% branding | ~57% QR | ~12% info | ~7% footer (46px)
 */
async function buildUpiCard(qrEl, logoImg, data) {
  const pc        = /^#[0-9a-fA-F]{6}$/.test(data.primaryColor||'') ? data.primaryColor : '#0d2e8a';
  const bgColor   = /^#[0-9a-fA-F]{6}$/.test(data.bgColor||'')      ? data.bgColor      : '#ffffff';
  const brandName = data.brandName || data.payeeName || 'Brand';
  const tagline   = (data.tagline  || '').trim();
  const upiId     = data.upiId || '';

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

  /* 5"×11" with logo (H=1100) / 5"×7" without logo (H=700) at 100px/in × 2× retina
   * Logo: 3.5" dominant (350px tall). QS=380 (3.8") QR. W=500 locked.
   * Output PNG: 1048×2248 (logo) / 1048×1448 (no logo).
   */
  const W=500, H=logoImg ? 1100 : 700, M=12, SC=2;
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
    ctx.fillStyle='#002970'; ctx.font=`900 ${Math.round(bh*0.43)}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Pay',bx+bw*0.38,by+bh/2+1);
    ctx.fillStyle='#00BAF2';
    ctx.fillText('tm',bx+bw*0.72,by+bh/2+1);
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

  let y = M+22;

  // ── LOGO — dominant 3.5" (350px) block ───────────────────────────
  if (logoImg) {
    const maxH=350, maxW=W*0.82;   // 350px = 3.5" at 100px/in
    const sc=Math.min(maxH/logoImg.naturalHeight, maxW/logoImg.naturalWidth);
    const lw=Math.round(logoImg.naturalWidth*sc), lh=Math.round(logoImg.naturalHeight*sc);
    ctx.drawImage(logoImg, cx-lw/2, y, lw, lh);
    y += lh+18;
  }

  // ── BRAND NAME ───────────────────────────────────────────────────
  ctx.fillStyle=textCol; ctx.textAlign='center'; ctx.textBaseline='top';
  let fs = 32;
  ctx.font=`900 ${fs}px sans-serif`;
  while(ctx.measureText(brandName.toUpperCase()).width>W-32&&fs>12){fs--;ctx.font=`900 ${fs}px sans-serif`;}
  ctx.fillText(brandName.toUpperCase(), cx, y);
  y += fs+8;

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
  const spTxt='SCAN & PAY', spW=ctx.measureText(spTxt).width;
  const dl=Math.max(0,(W-spW-48)/2-6);
  ctx.strokeStyle=textCol; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(M+16,y+10); ctx.lineTo(M+16+dl,y+10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+spW/2+6,y+10); ctx.lineTo(cx+spW/2+6+dl,y+10); ctx.stroke();
  ctx.fillText(spTxt, cx, y);
  y += 22;

  // ── VIA UPI ───────────────────────────────────────────────────────
  ctx.font='12px sans-serif'; ctx.fillStyle=muteCol; ctx.globalAlpha=1;
  ctx.fillText('VIA UPI', cx, y);
  y += 16;

  // ── QR BOX — QS=380 (3.8"), 15mm quiet zone ───────────────────────
  const QS=380, qbPad=10, qbSz=QS+qbPad*2;
  const qbX=M+(W-qbSz)/2, qbY=y+8;
  ctx.strokeStyle=pc; ctx.lineWidth=3;
  rr(qbX,qbY,qbSz,qbSz,14); ctx.stroke();
  // QR always on white for scannability
  ctx.fillStyle='#ffffff'; rr(qbX+2,qbY+2,qbSz-4,qbSz-4,12); ctx.fill();
  ctx.drawImage(qrEl, qbX+qbPad, qbY+qbPad, QS, QS);

  // Logo overlay — 22% of QS, square with rounded corners
  if (logoImg) {
    const os=Math.round(QS*0.22);
    const ox=qbX+qbPad+(QS-os)/2, oy=qbY+qbPad+(QS-os)/2;
    ctx.fillStyle='#ffffff'; rr(ox-5,oy-5,os+10,os+10,7); ctx.fill();
    ctx.save(); rr(ox,oy,os,os,5); ctx.clip();
    ctx.drawImage(logoImg,ox,oy,os,os); ctx.restore();
  }
  y = qbY+qbSz+14;

  // ── UPI ID PILL ───────────────────────────────────────────────────
  const pillH=36, pillW=W-60;
  ctx.fillStyle=pc; rr(M+30,y,pillW,pillH,pillH/2); ctx.fill();
  ctx.fillStyle='#ffffff'; ctx.font='900 20px monospace'; ctx.textBaseline='middle';
  let uid=upiId;
  while(ctx.measureText(uid).width>pillW-28&&uid.length>6) uid=uid.slice(0,-1);
  if(uid!==upiId) uid+='…';
  ctx.fillText(uid, cx, y+pillH/2);
  y += pillH+10;

  // ── ALL UPI APPS ACCEPTED ─────────────────────────────────────────
  ctx.fillStyle=muteCol; ctx.font='bold 10px sans-serif'; ctx.textBaseline='top';
  ctx.fillText('ALL UPI APPS ACCEPTED', cx, y);
  y += 16;

  // ── PAYMENT APP LOGOS — SVG images (G Pay · PhonePe · Paytm) ────
  {
    // Load (or use cached) SVG badge images
    const [gpayImg, phonepeImg, paytmImg] = await Promise.all([
      loadBadge('gpay'), loadBadge('phonepe'), loadBadge('paytm'),
    ]);

    const bh = 36, gap = 10;
    // Aspect ratios match updated SVG viewBoxes exactly
    const badges = [
      { img: gpayImg,    ar: 124/48, fallback: drawGPayBadge    },
      { img: phonepeImg, ar: 168/48, fallback: drawPhonePeBadge },
      { img: paytmImg,   ar: 128/48, fallback: drawPaytmBadge   },
    ];
    const bws     = badges.map(b => Math.round(b.ar * bh));
    const totalBW = bws.reduce((s,w) => s+w, 0) + gap * (badges.length-1);
    let bx = cx - totalBW / 2;

    badges.forEach((b, i) => {
      const bw = bws[i];
      if (b.img) {
        // Subtle shadow so white badges lift off any card background
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur  = 6;
        ctx.shadowOffsetY = 2;
        ctx.drawImage(b.img, bx, y, bw, bh);
        ctx.restore();
      } else {
        b.fallback(bx, y, bw, bh);
      }
      bx += bw + gap;
    });
    y += bh;
  }

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
    ctx.fillStyle='#ffffff'; ctx.textBaseline='middle';
    items.forEach((it,i)=>{
      it.draw(tx,icY,icSz,'#ffffff');
      ctx.font=trustFont; ctx.fillStyle='#ffffff';
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
  return out.toDataURL('image/png');
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
