import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { exportTo3MF } from 'three-3mf-exporter';
import { quantize, quantizeToPalette, maskForColor, maskToGeometry } from './relief.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Sharp QR: white field plate + one merged box mesh for the dark modules,
 * positioned within `qrRect` (working-unit rect).
 *
 * The dark modules are merged into a single BufferGeometry rather than an
 * InstancedMesh: three's STL/3MF exporters do NOT expand per-instance matrices,
 * so an InstancedMesh would serialize as a single cube. A merged geometry
 * carries every module box into the exported (printable) file.
 *
 * `quietModules` adds a quiet-zone border (default 1) so the module pitch and
 * inset match the card image (the PNG draws the QR with a 1-module margin), i.e.
 * the 3D QR is geometrically identical to the card's QR. `logoRect` (working
 * units, optional) marks a centre region whose modules are SKIPPED so the
 * embedded logo can occupy it — exactly like the card's white logo backing.
 * @returns {{ group: THREE.Group, boxCount: number }}
 */
export function buildSharpQr(matrix, qrRect, { cellHeightMM, baseZ, quietModules = 1, logoRect = null, logoShape = 'rect', moduleColor = 0x000000 }) {
  const group = new THREE.Group();
  const size = matrix.size;
  const cellMM = qrRect.w / (size + 2 * quietModules);
  const field = new THREE.Mesh(
    new THREE.BoxGeometry(qrRect.w, qrRect.h, baseZ),
    new THREE.MeshStandardMaterial({ color: 0xffffff }));
  field.position.set(qrRect.x + qrRect.w/2, -(qrRect.y + qrRect.h/2), baseZ/2);
  group.add(field);

  // Skip modules under the logo backing. Service cards use a circular backing,
  // UPI a rounded square — carve the matching shape so the centre is clean.
  const lcx = logoRect && logoRect.x + logoRect.w/2;
  const lcy = logoRect && logoRect.y + logoRect.h/2;
  const lr2 = logoRect && (logoRect.w/2) * (logoRect.w/2);
  const inLogo = (px, py) => {
    if (!logoRect) return false;
    if (logoShape === 'circle') return (px-lcx)**2 + (py-lcy)**2 <= lr2;
    return px >= logoRect.x && px <= logoRect.x + logoRect.w &&
           py >= logoRect.y && py <= logoRect.y + logoRect.h;
  };

  const boxes = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (matrix.data[row * size + col] !== 1) continue;
      const px = qrRect.x + (quietModules + col + 0.5) * cellMM;
      const py = qrRect.y + (quietModules + row + 0.5) * cellMM;
      if (inLogo(px, py)) continue; // leave the centre clear for the embedded logo
      const box = new THREE.BoxGeometry(cellMM, cellMM, cellHeightMM);
      box.translate(px, -py, baseZ + cellHeightMM/2);
      boxes.push(box);
    }
  }
  const n = boxes.length;
  if (n > 0) {
    const merged = mergeGeometries(boxes, false);
    boxes.forEach(b => b.dispose());
    group.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: moduleColor })));
  }
  return { group, boxCount: n };
}

/**
 * Rasterize the QR matrix into RGBA pixels using the SAME row/col→position
 * mapping as buildSharpQr, for the decode gate. Dark=black, light=white,
 * with a 4-module quiet zone.
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export function rasterizeQrMatrix(matrix, px) {
  const q = 4, dim = (matrix.size + q*2) * px;
  const data = new Uint8ClampedArray(dim * dim * 4);
  for (let i = 0; i < data.length; i += 4) { data[i]=255; data[i+1]=255; data[i+2]=255; data[i+3]=255; }
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.data[row*matrix.size + col] !== 1) continue;
      for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) {
        const x = (q+col)*px + dx, y = (q+row)*px + dy, idx = (y*dim + x)*4;
        data[idx]=0; data[idx+1]=0; data[idx+2]=0; data[idx+3]=255;
      }
    }
  }
  return { data, width: dim, height: dim };
}

/**
 * Assemble the full plaque: base plate + per-colour relief meshes (QR region
 * excluded from segmentation) + sharp QR. Browser-only (uses document/canvas).
 * @returns {THREE.Group}
 */
export function build(canvas, layout, matrix, opts = {}) {
  const k = opts.colors || 4;
  // Default to the card's real-world print size. The card is rendered at
  // 100px/inch × 2 (retina), so canvasPx / 200 = inches → mm. A 5×11 card →
  // ~285mm long edge. Callers can override via opts.longEdgeMM.
  const longEdgeMM = opts.longEdgeMM || (Math.max(canvas.width, canvas.height) / 200) * 25.4;
  const baseT = opts.baseThickness || 2;
  const layerH = opts.layerHeight || 0.8;

  // Higher working resolution so the (bold, 0.4mm-sized) text strokes survive
  // contouring and actually appear in the printed relief. Palette-snap quantize
  // is a cheap single pass, so we can afford it.
  const targetLong = opts.workPx || 760;
  const scale = targetLong / Math.max(canvas.width, canvas.height);
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  const sctx = small.getContext('2d');
  sctx.drawImage(canvas, 0, 0, w, h);
  const img = sctx.getImageData(0, 0, w, h);

  const r = layout.qrRect, qx = Math.round(r.x*scale), qy = Math.round(r.y*scale),
        qw = Math.round(r.w*scale), qh = Math.round(r.h*scale);
  for (let y = qy; y < qy + qh; y++) for (let x = qx; x < qx + qw; x++) {
    const i = (y*w + x)*4; img.data[i]=img.data[i+1]=img.data[i+2]=255;
  }

  const pxToMM = longEdgeMM / Math.max(w, h);
  const group = new THREE.Group();

  // Quantize. Prefer SNAP-TO-PALETTE using the card's exact design colours
  // (layout.paletteHints) → clean layers with no muddy intermediate shades,
  // ideal for multi-material 3MF. Fall back to k-means if hints are absent.
  const hints = Array.isArray(layout.paletteHints) ? layout.paletteHints.filter(Boolean) : null;
  const { palette, labels } = hints && hints.length
    ? quantizeToPalette(img, hints)
    : quantize(img, k);
  const nColors = palette.length;
  const baseIdx = dominantLabel(labels, nColors);

  // Rounded-corner base plate (matches the card's rounded rectangle) — a finished
  // plaque look rather than a hard-edged slab.
  const plateW = w*pxToMM, plateH = h*pxToMM, plateR = plateW * 0.04;
  const plateGeo = new THREE.ExtrudeGeometry(roundedRectShape(plateW, plateH, plateR),
    { depth: baseT, bevelEnabled: false });
  const plate = new THREE.Mesh(plateGeo,
    new THREE.MeshStandardMaterial({ color: rgbHex(palette[baseIdx]) }));
  plate.position.set(plateW/2, -plateH/2, 0); // centred shape → align to relief frame
  group.add(plate);

  for (let c = 0; c < nColors; c++) {
    if (c === baseIdx) continue;
    try {
      const mask = maskForColor(labels, c, { width: w, height: h });
      if (mask.reduce((s,v)=>s+v,0) === 0) continue;
      const geo = maskToGeometry(mask, { width: w, height: h, heightMM: layerH, pxToMM });
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: rgbHex(palette[c]) }));
      mesh.position.z = baseT;
      group.add(mesh);
    } catch (e) { console.warn('relief layer skipped', c, e.message); }
  }

  // QR sits ON TOP of the base plate: a thin white field (layerH) lifted to z=baseT
  // with black modules above it. Using baseZ=baseT here would bury the white field
  // inside the base plate (overlapping volumes / coplanar faces) — wrong for a
  // one-object-per-colour 3MF and causes z-fighting in preview.
  const qrRectMM = { x: r.x*scale*pxToMM, y: r.y*scale*pxToMM, w: r.w*scale*pxToMM, h: r.h*scale*pxToMM };
  // Embedded centre logo: carve its modules out of the QR and rebuild it as a
  // colour relief from the (un-blanked) source canvas — matching the card's
  // logo-in-QR-centre treatment (e.g. the bhuvis_qr.png emblem).
  const lr = layout.logoRect;
  const logoShape = layout.logoShape || 'rect';
  const logoRectMM = lr && { x: lr.x*scale*pxToMM, y: lr.y*scale*pxToMM, w: lr.w*scale*pxToMM, h: lr.h*scale*pxToMM };
  const { group: qrGroup } = buildSharpQr(matrix, qrRectMM,
    { cellHeightMM: layerH, baseZ: layerH, logoRect: logoRectMM, logoShape,
      moduleColor: layout.qrColor || 0x000000 });
  if (lr) {
    // Prefer the dedicated SVG logo (crisp vector) for the 3D centre; else crop
    // the rendered card canvas.
    try { buildCenterLogo(canvas, lr, logoRectMM, layerH, logoShape, opts.logoSvgImg || null).children.forEach(m => qrGroup.add(m)); }
    catch (e) { console.warn('centre logo skipped', e.message); }
  }
  qrGroup.position.z = baseT;
  group.add(qrGroup);
  return group;
}

/**
 * Build the embedded centre logo as a colour relief, cropped from the (full-res,
 * un-blanked) source card canvas. The DOMINANT (most-common) colour cluster is
 * treated as the backing and skipped — works whether the backing is light or
 * dark; the remaining clusters extrude as the raised logo. Returns a THREE.Group
 * whose meshes sit at z=heightMM (on top of the QR field), in qrRectMM coords.
 */
function buildCenterLogo(srcCanvas, logoRectDev, logoRectMM, heightMM, logoShape = 'rect', svgImg = null) {
  const work = svgImg ? 256 : 160; // SVG → render larger for a crisper silhouette
  const cc = document.createElement('canvas'); cc.width = work; cc.height = work;
  const cx = cc.getContext('2d');
  cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, work, work); // flatten transparency to white
  if (svgImg && svgImg.width && svgImg.height) {
    // Crisp vector logo: contain-fit into the work square (small inset).
    const pad = work * 0.06, avail = work - pad*2;
    const s = Math.min(avail / svgImg.width, avail / svgImg.height);
    const dw = svgImg.width * s, dh = svgImg.height * s;
    cx.drawImage(svgImg, (work-dw)/2, (work-dh)/2, dw, dh);
  } else {
    cx.drawImage(srcCanvas, logoRectDev.x, logoRectDev.y, logoRectDev.w, logoRectDev.h, 0, 0, work, work);
  }
  // Service cards use a circular logo backing: mask the crop to a circle so the
  // square corners don't extrude as stray relief.
  if (logoShape === 'circle') {
    cx.globalCompositeOperation = 'destination-in';
    cx.beginPath(); cx.arc(work/2, work/2, work/2, 0, Math.PI*2); cx.fill();
    cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = '#ffffff';
    cx.save(); cx.beginPath();
    cx.rect(0,0,work,work);
    cx.moveTo(work, work/2); cx.arc(work/2, work/2, work/2, 0, Math.PI*2);
    cx.fill('evenodd'); // paint white into the corners outside the circle
    cx.restore();
  }
  const img = cx.getImageData(0, 0, work, work);
  // k=3 keeps the logo's real colours while limiting anti-alias "muddy" shades.
  const k = 3;
  const { palette, labels } = quantize(img, k);
  // Backing = the dominant (most-common) cluster, whether light or dark.
  const counts = new Array(palette.length).fill(0);
  for (const l of labels) counts[l]++;
  const bg = counts.indexOf(Math.max(...counts));
  const grp = new THREE.Group();
  const pxToMM_logo = logoRectMM.w / work;
  for (let c = 0; c < palette.length; c++) {
    if (c === bg) continue;
    try {
      const mask = maskForColor(labels, c, { width: work, height: work });
      if (mask.reduce((s, v) => s + v, 0) === 0) continue;
      const geo = maskToGeometry(mask, { width: work, height: work, heightMM, pxToMM: pxToMM_logo });
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: rgbHex(palette[c]) }));
      mesh.position.set(logoRectMM.x, -logoRectMM.y, heightMM);
      grp.add(mesh);
    } catch (e) { /* skip empty/failed cluster */ }
  }
  return grp;
}

/** Centred rounded-rectangle THREE.Shape (origin at centre), for the base plate. */
function roundedRectShape(w, h, r) {
  r = Math.min(r, w/2, h/2);
  const s = new THREE.Shape();
  s.moveTo(-w/2 + r, -h/2);
  s.lineTo(w/2 - r, -h/2);
  s.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
  s.lineTo(w/2, h/2 - r);
  s.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
  s.lineTo(-w/2 + r, h/2);
  s.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
  s.lineTo(-w/2, -h/2 + r);
  s.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);
  return s;
}

function rgbHex([r,g,b]) { return (r<<16)|(g<<8)|b; }
function dominantLabel(labels, k) {
  const c = new Array(k).fill(0); for (const l of labels) c[l]++;
  return c.indexOf(Math.max(...c));
}

/** Browser: STL Blob. */
export function exportSTL(group) {
  const stl = new STLExporter().parse(group, { binary: true });
  return new Blob([stl], { type: 'model/stl' });
}
/** Node-testable: STL Buffer. */
export async function exportSTLBuffer(group) {
  const stl = new STLExporter().parse(group, { binary: true });
  return Buffer.from(stl.buffer || stl);
}

/** Browser: 3MF Blob, one object per colour (Bambu-compatible). */
export function export3MF(group) {
  return exportTo3MF(group); // Promise<Blob>
}
/** Node-testable: 3MF Buffer. */
export async function export3MFBuffer(group) {
  const blob = await exportTo3MF(group);
  return Buffer.from(await blob.arrayBuffer());
}

let _renderer, _controls, _raf;
/** Mount an interactive WebGL preview of `group` into canvas element `canvasEl`. */
export function mountPreview(group, canvasEl) {
  disposePreview();
  if (typeof WebGLRenderingContext === 'undefined') throw new Error('NO_WEBGL');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14142a);
  group.position.set(0, 0, 0); // undo any offset from a previous mount (no accumulation)
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  group.position.sub(center); // center at origin
  scene.add(group);
  // Bright, multi-directional lighting so a near-black card still reads, and the
  // raised relief catches highlights/shadows. Hemisphere fill + key/back/side lights.
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(1, 1.5, 2); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-1.5, -0.5, 1); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(0, 0.5, -2); scene.add(rim);

  const w = canvasEl.clientWidth || 480, h = canvasEl.clientHeight || 480;
  const cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
  // Angled 3/4 view (not straight-on) so the raised relief depth is visible.
  const dist = (Math.max(size.x, size.y, size.z) || 100) * 1.9;
  cam.position.set(dist * 0.45, -dist * 0.30, dist * 0.95);
  cam.lookAt(0, 0, 0);
  _renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // crisp on HiDPI
  _renderer.setSize(w, h, false);
  _controls = new OrbitControls(cam, canvasEl);
  (function loop() { _raf = requestAnimationFrame(loop); _controls.update(); _renderer.render(scene, cam); })();
}
/** Stop and tear down the preview (safe to call when nothing is mounted). */
export function disposePreview() {
  if (_raf) cancelAnimationFrame(_raf);
  if (_controls) _controls.dispose();
  if (_renderer) _renderer.dispose();
  _renderer = _controls = _raf = null;
}

if (typeof window !== 'undefined') window.QR3D = { build, buildSharpQr, exportSTL, export3MF, mountPreview, disposePreview };
