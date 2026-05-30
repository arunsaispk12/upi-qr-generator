import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { exportTo3MF } from 'three-3mf-exporter';
import { quantize, maskForColor, maskToGeometry } from './relief.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Sharp QR: white field plate + one merged box mesh for the dark modules,
 * positioned within `qrRect` (working-unit rect).
 *
 * The dark modules are merged into a single BufferGeometry rather than an
 * InstancedMesh: three's STL/3MF exporters do NOT expand per-instance matrices,
 * so an InstancedMesh would serialize as a single cube. A merged geometry
 * carries every module box into the exported (printable) file.
 * @returns {{ group: THREE.Group, boxCount: number }}
 */
export function buildSharpQr(matrix, qrRect, { cellHeightMM, baseZ }) {
  const group = new THREE.Group();
  const cellMM = qrRect.w / matrix.size;
  const field = new THREE.Mesh(
    new THREE.BoxGeometry(qrRect.w, qrRect.h, baseZ),
    new THREE.MeshStandardMaterial({ color: 0xffffff }));
  field.position.set(qrRect.x + qrRect.w/2, -(qrRect.y + qrRect.h/2), baseZ/2);
  group.add(field);

  const boxes = [];
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.data[row * matrix.size + col] !== 1) continue;
      const px = qrRect.x + (col + 0.5) * cellMM;
      const py = qrRect.y + (row + 0.5) * cellMM;
      const box = new THREE.BoxGeometry(cellMM, cellMM, cellHeightMM);
      box.translate(px, -py, baseZ + cellHeightMM/2);
      boxes.push(box);
    }
  }
  const n = boxes.length;
  if (n > 0) {
    const merged = mergeGeometries(boxes, false);
    boxes.forEach(b => b.dispose());
    group.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0x000000 })));
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
  const longEdgeMM = opts.longEdgeMM || 100;
  const baseT = opts.baseThickness || 2;
  const layerH = opts.layerHeight || 0.8;

  const targetLong = opts.workPx || 350;
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

  // Quantize first so the base plate can take the DOMINANT CLUSTER colour
  // (e.g. the card's black), not the muddy pixel average that the gold accents
  // and the blanked-white QR region would skew.
  const { palette, labels } = quantize(img, k);
  const baseIdx = dominantLabel(labels, k);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(w*pxToMM, h*pxToMM, baseT),
    new THREE.MeshStandardMaterial({ color: rgbHex(palette[baseIdx]) }));
  plate.position.set(w*pxToMM/2, -h*pxToMM/2, baseT/2);
  group.add(plate);

  for (let c = 0; c < k; c++) {
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
  const { group: qrGroup } = buildSharpQr(matrix, qrRectMM, { cellHeightMM: layerH, baseZ: layerH });
  qrGroup.position.z = baseT;
  group.add(qrGroup);
  return group;
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
