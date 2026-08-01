import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
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
    let merged = mergeGeometries(boxes, false);
    boxes.forEach(b => b.dispose());
    // Weld coincident vertices from adjacent module boxes → fewer non-manifold edges.
    try { merged = mergeVertices(merged); } catch (e) { /* keep unwelded on failure */ }
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: moduleColor }));
    // Sink the modules slightly into the white field so their bottom faces aren't
    // coincident with the field's top face (coincident faces = non-manifold).
    mesh.position.z = -0.02;
    group.add(mesh);
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
  const qrRectMM = { x: r.x*scale*pxToMM, y: r.y*scale*pxToMM, w: r.w*scale*pxToMM, h: r.h*scale*pxToMM };
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
  // plaque look rather than a hard-edged slab. The QR-rect footprint is always
  // cut out of it (see roundedRectWithTabShape) and filled flush by the QR's
  // own white field mesh below — two solids meeting at a shared XY boundary,
  // not stacked on top of each other, so there's no step and nothing to
  // z-fight: the previous "thin raised skin" approach could never be BOTH
  // visually flush AND non-manifold-safe at the same time, since a truly
  // flush top face is, by definition, coincident with the plate's.
  const plateW = w*pxToMM, plateH = h*pxToMM, plateR = plateW * 0.04;
  // Keyring tab + hole, when requested, has to be part of the SAME contour as
  // the plate (a single ExtrudeGeometry with the hole cut via shape.holes) —
  // this file has no CSG boolean library, so a separately-placed boss+cylinder
  // pair could never actually remove material for a real hole.
  const tab = opts.keyringHole
    ? { edge: opts.keyringPosition || 0, tabDiameter: opts.tabDiameter || 12,
        holeDiameter: opts.holeDiameter || 5 }
    : null;
  const plateGeo = new THREE.ExtrudeGeometry(
    roundedRectWithTabShape(plateW, plateH, plateR, tab, qrRectMM),
    { depth: baseT, bevelEnabled: false });
  const plate = new THREE.Mesh(plateGeo,
    new THREE.MeshStandardMaterial({ color: rgbHex(palette[baseIdx]) }));
  group.add(plate); // shape is built directly in scene coordinates, no offset needed

  for (let c = 0; c < nColors; c++) {
    if (c === baseIdx) continue;
    try {
      const mask = maskForColor(labels, c, { width: w, height: h });
      if (mask.reduce((s,v)=>s+v,0) === 0) continue;
      const geo = maskToGeometry(mask, { width: w, height: h, heightMM: layerH, pxToMM });
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: rgbHex(palette[c]) }));
      // Overlap into the base plate (not coincident at z=baseT) to avoid the
      // coincident-face non-manifold edges Bambu flags.
      mesh.position.z = baseT - 0.02;
      group.add(mesh);
    } catch (e) { console.warn('relief layer skipped', c, e.message); }
  }

  // QR: the white "field" mesh below fills the plate's QR-rect cutout FLUSH —
  // baseZ: baseT makes it exactly as thick as the plate, and qrGroup sits at
  // z=0 (not offset above the plate), so it occupies precisely the same
  // z-range [0, baseT] as the hole it fills. Only the dark modules (stacked
  // on top of the field, per buildSharpQr's own baseZ+cellHeightMM/2 logic)
  // stand proud of that shared surface.
  // Embedded centre logo: carve its modules out of the QR and rebuild it as a
  // colour relief from the (un-blanked) source canvas — matching the card's
  // logo-in-QR-centre treatment (e.g. the bhuvis_qr.png emblem).
  const lr = layout.logoRect;
  const logoShape = layout.logoShape || 'rect';
  const logoRectMM = lr && { x: lr.x*scale*pxToMM, y: lr.y*scale*pxToMM, w: lr.w*scale*pxToMM, h: lr.h*scale*pxToMM };
  const { group: qrGroup } = buildSharpQr(matrix, qrRectMM,
    { cellHeightMM: layerH, baseZ: baseT, logoRect: logoRectMM, logoShape,
      moduleColor: layout.qrColor || 0x000000 });
  if (lr) {
    // Prefer the dedicated SVG logo (crisp vector) for the 3D centre; else crop
    // the rendered card canvas. Sink 0.02mm into the field's top (now = baseT,
    // the field's full thickness) — same anti-coincident-face overlap every
    // other layer in this file uses.
    try { buildCenterLogo(canvas, lr, logoRectMM, layerH, baseT - 0.02, logoShape, opts.logoSvgImg || null).children.forEach(m => qrGroup.add(m)); }
    catch (e) { console.warn('centre logo skipped', e.message); }
  }
  // qrGroup itself needs NO z offset: its field fills the plate's cutout hole
  // exactly, from z=0 to z=baseT, matching the plate's own thickness.
  group.add(qrGroup);
  return group;
}

/**
 * Build the embedded centre logo as a colour relief, cropped from the (full-res,
 * un-blanked) source card canvas. The DOMINANT (most-common) colour cluster is
 * treated as the backing and skipped — works whether the backing is light or
 * dark; the remaining clusters extrude as the raised logo. Returns a THREE.Group
 * whose meshes sit at z=baseZOffsetMM (on top of the QR field), in qrRectMM
 * coords — baseZOffsetMM is independent of heightMM (the logo's OWN relief
 * thickness) precisely because the field it sits on is now much thinner than
 * a QR module; conflating the two left a gap between the field and the logo.
 */
function buildCenterLogo(srcCanvas, logoRectDev, logoRectMM, heightMM, baseZOffsetMM, logoShape = 'rect', svgImg = null) {
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
  // Every bundled /logos/*.svg badge is pure monochrome (solid black fill on
  // a transparent/white background) — genuinely only 2 real colours. Blind
  // k-means (k=3) on a 2-colour source doesn't "limit" anti-alias shades, it
  // hands the antialiasing halo along every edge its OWN 3rd cluster (since
  // k-means always fills all k slots), which then gets extruded as a separate
  // 1-2px-wide ring — too thin to print cleanly, and unstable under corner
  // smoothing (a near-zero-width band self-intersects when corner-cut),
  // which is exactly the "dashed/bumpy thin outline" artifact around the
  // WhatsApp icon. Snapping straight to the two REAL colours (same
  // nearest-colour technique the main card render already uses via
  // quantizeToPalette/paletteHints) leaves no room for that halo cluster to
  // exist at all: every edge pixel goes to whichever real colour it's closer
  // to, so the icon's outline is exactly the SVG's own solid, un-halo'd
  // silhouette. The non-SVG fallback below (photographic canvas crop) has no
  // known palette, so it still needs blind quantize().
  const { palette, labels } = svgImg
    ? quantizeToPalette(img, ['#000000', '#ffffff'])
    : quantize(img, 3);
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
      mesh.position.set(logoRectMM.x, -logoRectMM.y, baseZOffsetMM);
      grp.add(mesh);
    } catch (e) { /* skip empty/failed cluster */ }
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Keyring tab: a circular boss unioned onto the middle of one plate edge, with
// the keyring hole punched straight through. Unlike the relief/QR layers
// above, this can't be a separately-placed boss + cylinder pair — this file
// has no CSG boolean library, so nothing would ever actually remove material
// for the hole. Instead the tab bulge and the hole are built into ONE
// THREE.Shape (bulge as part of the outer contour, hole via shape.holes), so
// a single ExtrudeGeometry produces a real through-hole.
//
// tab.edge: 0 top, 1 right, 2 bottom, 3 left (matches the UI's keyringPosition).
// The tab always centres on the middle of that edge, offset so its centre
// sits 0.25×tabDiameter beyond the edge line (same proportions as the
// OpenSCAD/Fusion builders' tab_x/tab_y formulas) — 0.75×tabDiameter pokes
// outside the plate, 0.25×tabDiameter overlaps into it.
// ---------------------------------------------------------------------------

const TAB_OFFSET_RATIO = 0.25;

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Reverse `pts` if needed so its winding matches `ccw` (signed area sign). */
function ensureWinding(pts, ccw) {
  return (signedArea(pts) > 0) === ccw ? pts : pts.slice().reverse();
}

function sampleCircle(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Tab centre in canvas (x right, y down) coordinates. */
function tabCenterCanvas(w, h, tab) {
  const vc = tab.tabDiameter * TAB_OFFSET_RATIO;
  switch (tab.edge) {
    case 0: return [w / 2, -vc];    // top
    case 1: return [w + vc, h / 2]; // right
    case 2: return [w / 2, h + vc]; // bottom
    default: return [-vc, h / 2];   // left
  }
}

/**
 * Outer contour of the plate (+ tab bulge, if any) as canvas-space points,
 * traced top-left → top edge → top-right → right edge → bottom-right →
 * bottom edge → bottom-left → left edge, each corner a quarter-circle.
 * On the tab's edge, the straight run is replaced by: run up to the first
 * tangent point, an arc around the OUTSIDE of the tab circle (the major arc,
 * through the point farthest from the plate) to the second tangent point,
 * then the straight run resumes — the same shape a real 2D union would give.
 */
function plateOutlinePoints(w, h, r, tab) {
  const N_CORNER = 8, N_ARC = 16;
  const pts = [];
  const corner = (cx, cy, a0, a1) => {
    for (let i = 0; i <= N_CORNER; i++) {
      const a = a0 + (a1 - a0) * i / N_CORNER;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  const edge = (edgeIdx, len, toCanvas) => {
    const u0 = r, u1 = len - r;
    if (!tab || tab.edge !== edgeIdx) {
      pts.push(toCanvas(u0, 0));
      pts.push(toCanvas(u1, 0));
      return;
    }
    // Local (u,v) frame for this edge: v=0 is the edge line, v>0 is outward
    // (away from the plate) — see tabCenterCanvas for the matching mapping.
    const R = tab.tabDiameter / 2;
    const vc = tab.tabDiameter * TAB_OFFSET_RATIO;
    const uc = len / 2;
    const c = Math.sqrt(Math.max(0, R * R - vc * vc));
    // Tangent-point angles are always in (-180°,-90°) and (-90°,0°) respectively
    // (vc, c > 0), so subtracting a full turn from the second always sweeps the
    // long way around through the +90° apex — the outward bulge, not the small
    // inward cap where the tab overlaps the plate.
    const start = Math.atan2(-vc, -c);
    const end = Math.atan2(-vc, c) - Math.PI * 2;
    pts.push(toCanvas(u0, 0));
    pts.push(toCanvas(uc - c, 0));
    for (let i = 0; i <= N_ARC; i++) {
      const a = start + (end - start) * i / N_ARC;
      pts.push(toCanvas(uc + R * Math.cos(a), vc + R * Math.sin(a)));
    }
    pts.push(toCanvas(uc + c, 0));
    pts.push(toCanvas(u1, 0));
  };

  corner(r, r, Math.PI, 1.5 * Math.PI);              // top-left
  edge(0, w, (u, v) => [u, -v]);                     // top
  corner(w - r, r, 1.5 * Math.PI, 2 * Math.PI);      // top-right
  edge(1, h, (u, v) => [w + v, u]);                  // right
  corner(w - r, h - r, 0, 0.5 * Math.PI);            // bottom-right
  edge(2, w, (u, v) => [w - u, h + v]);               // bottom
  corner(r, h - r, 0.5 * Math.PI, Math.PI);          // bottom-left
  edge(3, h, (u, v) => [-v, h - u]);                  // left
  return pts;
}

function rectHolePoints(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

/** Push a hole (given as canvas-space points) into `shape`, oriented opposite the outer contour. */
function addHole(shape, canvasPts) {
  const pts = ensureWinding(canvasPts.map(([x, y]) => [x, -y]), false);
  const path = new THREE.Path();
  pts.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  shape.holes.push(path);
}

/**
 * Base-plate THREE.Shape: a keyring tab bulge unioned into the outer contour
 * (optional) with the keyring hole (optional) and the QR-rect footprint
 * (`qrHoleRect`, canvas-space {x,y,w,h}) punched through as genuine shape
 * holes (see the section comment above for why this has to be one shape).
 *
 * The QR-rect hole matters even without a keyring tab: the QR's own white
 * field mesh (built separately, see build()) fills this hole FLUSH — same
 * z-range as the plate, not stacked on top of it — so the plate and the QR
 * background share one continuous top surface with no step and no overlap
 * to z-fight over. Built directly in this file's scene coordinates
 * (scene_y = -canvas_y).
 */
export function roundedRectWithTabShape(w, h, r, tab, qrHoleRect) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const outer = ensureWinding(
    plateOutlinePoints(w, h, r, tab).map(([x, y]) => [x, -y]), true);

  const shape = new THREE.Shape();
  outer.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();

  if (tab && tab.holeDiameter > 0) {
    const [hcx, hcy] = tabCenterCanvas(w, h, tab);
    addHole(shape, sampleCircle(hcx, hcy, tab.holeDiameter / 2, 32));
  }
  if (qrHoleRect) {
    addHole(shape, rectHolePoints(qrHoleRect.x, qrHoleRect.y, qrHoleRect.w, qrHoleRect.h));
  }
  return shape;
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
