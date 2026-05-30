import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { quantize, maskForColor, maskToGeometry } from './relief.js';

/**
 * Sharp QR: white field plate + one InstancedMesh of boxes for dark modules,
 * positioned within `qrRect` (working-unit rect).
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

  let dark = 0;
  for (let i = 0; i < matrix.size * matrix.size; i++) if (matrix.data[i] === 1) dark++;

  const inst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(cellMM, cellMM, cellHeightMM),
    new THREE.MeshStandardMaterial({ color: 0x000000 }), Math.max(dark, 1));
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.data[row * matrix.size + col] !== 1) continue;
      const px = qrRect.x + (col + 0.5) * cellMM;
      const py = qrRect.y + (row + 0.5) * cellMM;
      dummy.position.set(px, -py, baseZ + cellHeightMM/2);
      dummy.updateMatrix();
      inst.setMatrixAt(n++, dummy.matrix);
    }
  }
  inst.count = n;
  group.add(inst);
  return { group, boxCount: n };
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

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(w*pxToMM, h*pxToMM, baseT),
    new THREE.MeshStandardMaterial({ color: rgbHex(dominant(img)) }));
  plate.position.set(w*pxToMM/2, -h*pxToMM/2, baseT/2);
  group.add(plate);

  const { palette, labels } = quantize(img, k);
  const baseIdx = dominantLabel(labels, k);
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

  const qrRectMM = { x: r.x*scale*pxToMM, y: r.y*scale*pxToMM, w: r.w*scale*pxToMM, h: r.h*scale*pxToMM };
  const { group: qrGroup } = buildSharpQr(matrix, qrRectMM, { cellHeightMM: layerH, baseZ: baseT });
  group.add(qrGroup);
  return group;
}

function rgbHex([r,g,b]) { return (r<<16)|(g<<8)|b; }
function dominant(img) {
  let r=0,g=0,b=0,n=img.width*img.height;
  for (let i=0;i<n;i++){r+=img.data[i*4];g+=img.data[i*4+1];b+=img.data[i*4+2];}
  return [Math.round(r/n),Math.round(g/n),Math.round(b/n)];
}
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

if (typeof window !== 'undefined') window.QR3D = { build, buildSharpQr, exportSTL };
