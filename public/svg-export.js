/* ============================================================================
 * svg-export.js — PURE-VECTOR card SVG for parametric CAD / extrusion.
 *
 * The old export laid vector text over a raster PNG of the whole card, so every
 * string existed twice and smeared (the "doubling"). It also embedded a raster
 * <image>, which Fusion / FreeCAD / Blender / OpenSCAD all DROP on import — so
 * it wasn't actually extrudable. This module produces a single coherent vector
 * file instead: NO raster base, text converted to glyph OUTLINES (paths), QR as
 * one exact-fit union path, brand logos inlined from their .svg sources.
 *
 * How it stays faithful to the LOCKED card layout without duplicating it: a
 * lightweight recorder shim wraps the real canvas during buildUpiCard and
 * replays the actual draw calls (fills/strokes/text/images) as SVG. Coordinates
 * are recorded in LOGICAL space (the canvas is uniformly scaled by SC once), so
 * the SVG viewBox is the logical card and stroke widths/sizes map 1:1.
 * ========================================================================== */
(function () {
  'use strict';

  // ── Fonts (vendored WOFF, parsed by opentype.js for text→outline) ─────────
  // The card draws with generic sans-serif / monospace at weights 500-900. We
  // outline against a deterministic OFL family so the file renders identically
  // on every machine (better for a print/CAD artifact than a system font).
  // Latin-subset TTFs with GSUB/GPOS/GDEF dropped (opentype.js can't parse some
  // GSUB lookups, and we don't need shaping) — see scripts that build them.
  const FONT_URLS = {
    'archivo-700': 'fonts/archivo-700.ttf',
    'archivo-800': 'fonts/archivo-800.ttf',
    'archivo-900': 'fonts/archivo-900.ttf',
    'mono-800':    'fonts/jetbrainsmono-800.ttf',
  };
  const _fonts = {};
  let _fontsPromise = null;

  function loadFonts() {
    if (_fontsPromise) return _fontsPromise;
    if (typeof opentype === 'undefined')
      return Promise.reject(new Error('opentype.js not loaded'));
    _fontsPromise = Promise.all(Object.entries(FONT_URLS).map(async ([k, url]) => {
      const buf = await (await fetch(url)).arrayBuffer();
      _fonts[k] = opentype.parse(buf);
    })).then(() => _fonts);
    return _fontsPromise;
  }

  function pickFont(family, weight) {
    if (/mono/i.test(family || '')) return _fonts['mono-800'];
    const w = parseInt(weight, 10) || (weight === 'bold' ? 700 : 400);
    if (w >= 850) return _fonts['archivo-900'];
    if (w >= 750) return _fonts['archivo-800'];
    return _fonts['archivo-700'];
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  const f2 = (n) => {
    const r = Math.round(n * 100) / 100;
    return Object.is(r, -0) ? 0 : r;
  };
  function xmlEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Normalize any canvas colour string → { hex:'#rrggbb', a:0..1 }.
  function parseColor(c) {
    if (typeof c !== 'string') return { hex: '#000000', a: 1 };
    c = c.trim();
    if (c[0] === '#') {
      if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      if (c.length === 9) return { hex: c.slice(0, 7).toLowerCase(), a: parseInt(c.slice(7, 9), 16) / 255 };
      return { hex: c.slice(0, 7).toLowerCase(), a: 1 };
    }
    const m = /rgba?\(([^)]+)\)/i.exec(c);
    if (m) {
      const p = m[1].split(',').map((s) => parseFloat(s));
      const a = p.length > 3 ? p[3] : 1;
      const h = (n) => ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2);
      return { hex: '#' + h(p[0]) + h(p[1]) + h(p[2]), a };
    }
    return { hex: c, a: 1 }; // named colour — emit verbatim
  }

  // ── Recorder: wrap a 2D context, capture draws as ordered vector ops ──────
  // Records in the order drawn so SVG z-order matches the canvas. Path coords
  // are logical (the ctx is already scale(SC)'d). Ignores clip/shadow (not
  // needed for solid vector geometry).
  function makeRecorder(ctx) {
    const ops = [];
    let d = '';                       // current path data (since beginPath)
    const orig = {};
    ['beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo',
      'arc', 'rect', 'closePath', 'fill', 'stroke', 'fillText', 'drawImage']
      .forEach((k) => { orig[k] = ctx[k].bind(ctx); });

    ctx.beginPath = function () { d = ''; return orig.beginPath(); };
    ctx.moveTo = function (x, y) { d += `M${f2(x)} ${f2(y)}`; return orig.moveTo(x, y); };
    ctx.lineTo = function (x, y) { d += `L${f2(x)} ${f2(y)}`; return orig.lineTo(x, y); };
    ctx.quadraticCurveTo = function (cx, cy, x, y) {
      d += `Q${f2(cx)} ${f2(cy)} ${f2(x)} ${f2(y)}`; return orig.quadraticCurveTo(cx, cy, x, y);
    };
    ctx.bezierCurveTo = function (a, b, c, e, x, y) {
      d += `C${f2(a)} ${f2(b)} ${f2(c)} ${f2(e)} ${f2(x)} ${f2(y)}`;
      return orig.bezierCurveTo(a, b, c, e, x, y);
    };
    ctx.rect = function (x, y, w, h) {
      d += `M${f2(x)} ${f2(y)}h${f2(w)}v${f2(h)}h${f2(-w)}Z`; return orig.rect(x, y, w, h);
    };
    ctx.arc = function (cx, cy, r, a0, a1, ccw) {
      d += arcToSvg(cx, cy, r, a0, a1, !!ccw, d); return orig.arc(cx, cy, r, a0, a1, ccw);
    };
    ctx.closePath = function () { d += 'Z'; return orig.closePath(); };
    ctx.fill = function (rule) {
      ops.push({ t: 'fill', d, rule: rule === 'evenodd' ? 'evenodd' : 'nonzero',
        c: parseColor(ctx.fillStyle), ga: ctx.globalAlpha });
      return orig.fill(rule);
    };
    ctx.stroke = function () {
      ops.push({ t: 'stroke', d, c: parseColor(ctx.strokeStyle), ga: ctx.globalAlpha,
        sw: ctx.lineWidth, lj: ctx.lineJoin, lc: ctx.lineCap });
      return orig.stroke();
    };
    ctx.fillText = function (str, x, y) {
      ops.push({ t: 'text', str, x, y, font: ctx.font, fill: parseColor(ctx.fillStyle),
        align: ctx.textAlign, baseline: ctx.textBaseline, ga: ctx.globalAlpha });
      return orig.fillText(str, x, y);
    };
    ctx.drawImage = function (img, ...a) {
      if (a.length === 4)
        ops.push({ t: 'image', src: (img && img.src) || '', x: a[0], y: a[1], w: a[2], h: a[3] });
      return orig.drawImage(img, ...a);
    };
    return { ops };
  }

  // Canvas arc → SVG path fragment. Connects from the current point (line) or
  // starts a new subpath (move) when the path is empty / just closed.
  function arcToSvg(cx, cy, r, a0, a1, ccw, curD) {
    const TAU = Math.PI * 2;
    const sx = cx + r * Math.cos(a0), sy = cy + r * Math.sin(a0);
    const lead = (!curD || curD.endsWith('Z')) ? 'M' : 'L';
    let delta = a1 - a0;
    if (ccw) { if (delta > 0) delta -= TAU * Math.ceil(delta / TAU); }
    else { if (delta < 0) delta += TAU * Math.ceil(-delta / TAU); }
    if (Math.abs(delta) >= TAU - 1e-6) {            // full circle → two half arcs
      const ax = 2 * cx - sx, ay = 2 * cy - sy, sweep = ccw ? 0 : 1;
      return `${lead}${f2(sx)} ${f2(sy)}A${f2(r)} ${f2(r)} 0 1 ${sweep} ${f2(ax)} ${f2(ay)}`
        + `A${f2(r)} ${f2(r)} 0 1 ${sweep} ${f2(sx)} ${f2(sy)}`;
    }
    const ex = cx + r * Math.cos(a1), ey = cy + r * Math.sin(a1);
    const large = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = ccw ? 0 : 1;
    return `${lead}${f2(sx)} ${f2(sy)}A${f2(r)} ${f2(r)} 0 ${large} ${sweep} ${f2(ex)} ${f2(ey)}`;
  }

  // ── Text → outline path ───────────────────────────────────────────────────
  function textToPath(op) {
    const font = op.font || '';
    const mSize = /([\d.]+)px/.exec(font);
    const size = mSize ? parseFloat(mSize[1]) : 12;
    const mW = /(\d{3}|bold|bolder|lighter)/.exec(font);
    const weight = mW ? mW[1] : 'normal';
    const mFam = /px\s+(.+)$/.exec(font);
    const fam = mFam ? mFam[1] : 'sans-serif';
    const f = pickFont(fam, weight);
    if (!f) return '';
    const scale = size / f.unitsPerEm;
    const asc = f.ascender * scale;
    const desc = -f.descender * scale;            // positive
    let baseY;
    switch (op.baseline) {
      case 'top':    baseY = op.y + asc; break;
      case 'middle': baseY = op.y + (asc - desc) / 2; break;
      case 'bottom': baseY = op.y - desc; break;
      default:       baseY = op.y;                 // alphabetic
    }
    const adv = f.getAdvanceWidth(op.str, size);
    let ox = op.x;
    if (op.align === 'center') ox = op.x - adv / 2;
    else if (op.align === 'right' || op.align === 'end') ox = op.x - adv;
    // Render glyphs at the ORIGIN and position with a translate transform: baking
    // a fractional offset into opentype's path math can hit a rare FP degeneracy
    // that emits NaN coords (truncating the glyph run). The SVG renderer applies
    // the translate instead, sidestepping it; CAD tools flatten translates on import.
    let data = f.getPath(op.str, 0, 0, size).toPathData(2);
    if (!data) return '';
    if (data.indexOf('NaN') !== -1) {               // belt-and-braces guard
      data = f.getPath(op.str, 0.01, 0, size).toPathData(2);
      if (data.indexOf('NaN') !== -1) { console.warn('SVG text skipped (NaN path):', op.str); return ''; }
    }
    const opac = op.ga < 1 ? ` fill-opacity="${f2(op.ga)}"` : '';
    return `<path transform="translate(${f2(ox)} ${f2(baseY)})" d="${data}" fill="${op.fill.hex}"${opac}/>`;
  }

  // ── QR union outline (boundary edges only → one continuous region) ────────
  // Exact-fit fractional pitch matching the raster QR (1-module quiet baked in,
  // filling the whole field), so the vector QR lands inside the frame perfectly.
  function qrUnionPath(matrix, field, logoRect) {
    const bytes = (matrix.bytes instanceof Uint8Array)
      ? matrix.bytes
      : Uint8Array.from(atob(matrix.data), (c) => c.charCodeAt(0));
    const size = matrix.size;
    const pitch = field.w / (size + 2);            // 1-module quiet zone each side
    const ox = field.x + pitch, oy = field.y + pitch;
    const inLogo = (px, py) => logoRect &&
      px >= logoRect.x && px <= logoRect.x + logoRect.w &&
      py >= logoRect.y && py <= logoRect.y + logoRect.h;
    const isDark = (r, c) => r >= 0 && r < size && c >= 0 && c < size &&
      bytes[r * size + c] === 1 &&
      !inLogo(ox + (c + 0.5) * pitch, oy + (r + 0.5) * pitch);

    const key = (x, y) => x + '_' + y;
    const out = new Map();
    const push = (x1, y1, x2, y2) => {
      const k = key(x1, y1); (out.get(k) || out.set(k, []).get(k)).push([x2, y2]);
    };
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (!isDark(r, c)) continue;
      if (!isDark(r - 1, c)) push(c, r, c + 1, r);
      if (!isDark(r, c + 1)) push(c + 1, r, c + 1, r + 1);
      if (!isDark(r + 1, c)) push(c + 1, r + 1, c, r + 1);
      if (!isDark(r, c - 1)) push(c, r + 1, c, r);
    }
    const W = (gx, gy) => f2(ox + gx * pitch) + ' ' + f2(oy + gy * pitch);
    let d = '';
    for (const startK of out.keys()) {
      let arr = out.get(startK);
      while (arr && arr.length) {
        const [sx, sy] = startK.split('_').map(Number);
        const loop = [[sx, sy]];
        let [cx, cy] = arr.pop();
        while (!(cx === sx && cy === sy)) {
          loop.push([cx, cy]);
          const nexts = out.get(key(cx, cy));
          if (!nexts || !nexts.length) break;
          const [nx, ny] = nexts.pop(); cx = nx; cy = ny;
        }
        const n = loop.length, pts = [];
        for (let i = 0; i < n; i++) {
          const a = loop[(i - 1 + n) % n], b = loop[i], c2 = loop[(i + 1) % n];
          const collinear = (b[0] - a[0]) * (c2[1] - b[1]) === (b[1] - a[1]) * (c2[0] - b[0]);
          if (!collinear) pts.push(b);
        }
        if (pts.length >= 3) d += 'M' + pts.map((p) => W(p[0], p[1])).join('L') + 'Z';
        arr = out.get(startK);
      }
    }
    return d;
  }

  // ── Logo identification / inlining ────────────────────────────────────────
  // Brand logos are drawn from /logos/<name>.png; we have matching vector .svg
  // for each, which we fetch + inline as a nested <svg> (scales to the rect).
  const _svgCache = {};
  async function fetchLogoSvg(name) {
    if (name in _svgCache) return _svgCache[name];
    try {
      const txt = await (await fetch(`logos/${name}.svg`)).text();
      _svgCache[name] = /<svg[\s>]/i.test(txt) ? txt : null;
    } catch { _svgCache[name] = null; }
    return _svgCache[name];
  }
  function logoNameFromSrc(src) {
    const m = /\/logos\/([a-z0-9-]+)\.(?:png|svg)(?:[?#]|$)/i.exec(src || '');
    return m ? m[1] : null;
  }
  // Re-home a fetched <svg> string into a positioned/scaled nested <svg>.
  function nestSvg(svgText, x, y, w, h) {
    let inner = svgText.replace(/<\?xml[\s\S]*?\?>/i, '').replace(/<!DOCTYPE[\s\S]*?>/i, '');
    const open = /<svg\b([^>]*)>/i.exec(inner);
    if (!open) return '';
    const attrs = open[1];
    const vb = /viewBox\s*=\s*["']([^"']+)["']/i.exec(attrs);
    let viewBox = vb ? vb[1] : null;
    if (!viewBox) {
      const ww = /\bwidth\s*=\s*["']?([\d.]+)/i.exec(attrs);
      const hh = /\bheight\s*=\s*["']?([\d.]+)/i.exec(attrs);
      viewBox = `0 0 ${ww ? ww[1] : w} ${hh ? hh[1] : h}`;
    }
    const body = inner.slice(open.index + open[0].length).replace(/<\/svg>\s*$/i, '');
    return `<svg x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" `
      + `viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" overflow="visible">${body}</svg>`;
  }

  // ── Assemble + download the pure-vector SVG ───────────────────────────────
  async function buildVectorSVG(state, longMM) {
    await loadFonts();
    const lay = state.lastCard && state.lastCard.layout;
    const rec = lay && lay.svgRec;
    if (!lay || !rec) throw new Error('No recorded card geometry — re-generate the card.');

    const SC = lay.sc || 2;
    const CW = lay.cardW / SC, CH = lay.cardH / SC;          // logical card size
    const longPx = Math.max(CW, CH);
    const wMM = (CW / longPx) * longMM, hMM = (CH / longPx) * longMM;

    // QR field + logo rect in logical coords (layout stores them ×SC).
    const field = lay.qrRect ? { x: lay.qrRect.x / SC, y: lay.qrRect.y / SC, w: lay.qrRect.w / SC, h: lay.qrRect.h / SC } : null;
    const lrect = lay.logoRect ? { x: lay.logoRect.x / SC, y: lay.logoRect.y / SC, w: lay.logoRect.w / SC, h: lay.logoRect.h / SC } : null;
    const qrColor = (lay.qrColor || '#1a1a2e');

    // Pre-fetch every brand logo .svg referenced by an image draw.
    const logoNames = new Set();
    for (const op of rec.ops)
      if (op.t === 'image') { const n = logoNameFromSrc(op.src); if (n) logoNames.add(n); }
    const logoSvgs = {};
    await Promise.all([...logoNames].map(async (n) => { logoSvgs[n] = await fetchLogoSvg(n); }));

    // Walk recorded ops in z-order → emit vector.
    const parts = [];
    let qrPlaced = false;
    const isQrImg = (op) => field && Math.abs(op.w - field.w) < 2 && Math.abs(op.x - field.x) < 2 && Math.abs(op.y - field.y) < 2;

    for (const op of rec.ops) {
      if (op.t === 'fill') {
        if (!op.d) continue;
        const opac = op.c.a * op.ga;
        const fo = opac < 1 ? ` fill-opacity="${f2(opac)}"` : '';
        const fr = op.rule === 'evenodd' ? ' fill-rule="evenodd"' : '';
        parts.push(`<path d="${op.d}" fill="${op.c.hex}"${fr}${fo}/>`);
      } else if (op.t === 'stroke') {
        if (!op.d) continue;
        const opac = op.c.a * op.ga;
        const so = opac < 1 ? ` stroke-opacity="${f2(opac)}"` : '';
        parts.push(`<path d="${op.d}" fill="none" stroke="${op.c.hex}" stroke-width="${f2(op.sw)}"`
          + ` stroke-linejoin="${op.lj || 'miter'}" stroke-linecap="${op.lc || 'butt'}"${so}/>`);
      } else if (op.t === 'text') {
        const p = textToPath(op); if (p) parts.push(p);
      } else if (op.t === 'image') {
        if (isQrImg(op)) {
          // The QR bitmap → replace with the exact-fit union path (+ white field).
          if (state.qrMatrix && field) {
            const d = qrUnionPath(state.qrMatrix, field, lrect);
            parts.push(`<rect x="${f2(field.x)}" y="${f2(field.y)}" width="${f2(field.w)}" height="${f2(field.h)}" fill="#ffffff"/>`);
            if (d) parts.push(`<path d="${d}" fill="${qrColor}" fill-rule="evenodd"/>`);
            qrPlaced = true;
          }
          continue;
        }
        const name = logoNameFromSrc(op.src);
        if (name && logoSvgs[name]) {
          parts.push(nestSvg(logoSvgs[name], op.x, op.y, op.w, op.h));
        } else if (/^data:/.test(op.src)) {
          // User-uploaded bitmap logo — no vector source exists; embed it (the
          // only raster in the file, confined to the logo rect).
          parts.push(`<image x="${f2(op.x)}" y="${f2(op.y)}" width="${f2(op.w)}" height="${f2(op.h)}" xlink:href="${op.src}"/>`);
        }
        // else: src==='' canvas (trust-icon tint / rendered) → omit (keeps file pure vector).
      }
    }

    // Safety: if the QR draw wasn't matched (layout drift), still place it.
    if (!qrPlaced && state.qrMatrix && field) {
      const d = qrUnionPath(state.qrMatrix, field, lrect);
      parts.push(`<rect x="${f2(field.x)}" y="${f2(field.y)}" width="${f2(field.w)}" height="${f2(field.h)}" fill="#ffffff"/>`);
      if (d) parts.push(`<path d="${d}" fill="${qrColor}" fill-rule="evenodd"/>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n`
      + `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" `
      + `width="${wMM.toFixed(2)}mm" height="${hMM.toFixed(2)}mm" viewBox="0 0 ${f2(CW)} ${f2(CH)}">\n`
      + parts.join('\n') + `\n</svg>\n`;
  }

  window.SVGCard = { loadFonts, makeRecorder, buildVectorSVG,
    _internal: { parseColor, arcToSvg, textToPath, qrUnionPath, nestSvg, logoNameFromSrc } };
})();
