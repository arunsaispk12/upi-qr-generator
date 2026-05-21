const fs       = require('fs');
const path     = require('path');
const archiver = require('archiver');
const { Writable } = require('stream');

// Load library once at startup — fail fast if missing
let scadqrLib;
try {
  scadqrLib = fs.readFileSync(
    path.join(__dirname, '../scad/scadqr_library.scad'), 'utf8'
  );
} catch (e) {
  throw new Error(`scad-builder: cannot read scadqr_library.scad — ${e.message}`);
}

const escapeSCADStr = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function buildSCADString(opts) {
  const {
    qrString,
    payeeName       = 'QR',
    baseLength      = 90, baseWidth = 90, baseThickness = 2,
    qrSize          = 70, qrRaise   = 0.8,
    roundedCorners  = false, cornerRadius = 4,
    keyringHole     = false, holeDiameter = 5, tabDiameter = 12, keyringPosition = 0,
    centreLabel     = true, centreLabelText = 'QR', badgeWidth = 30, badgeHeight = 8,
    hasSvgLogo      = false,
  } = opts;

  const textSize = Math.round(badgeHeight * 0.55 * 10) / 10;
  const now      = new Date().toISOString().slice(0, 10);

  const centreBlock = hasSvgLogo
    ? `
    if (show_centre_label) {
        badge_x = qr_x + (qr_size - centre_badge_width) / 2;
        badge_y = qr_y + (qr_size - centre_badge_height) / 2;
        color(base_color)
            translate([badge_x, badge_y, base_thickness + qr_block_height])
                rounded_plate(centre_badge_width, centre_badge_height,
                    centre_badge_thickness,
                    min(2, centre_badge_width/2, centre_badge_height/2));
        color(label_color)
            translate([qr_x + qr_size/2, qr_y + qr_size/2,
                       base_thickness + qr_block_height + centre_badge_thickness])
                linear_extrude(height=centre_text_height)
                    import("logo.svg");
    }`
    : `
    if (show_centre_label && centre_label_text != "") {
        badge_x = qr_x + (qr_size - centre_badge_width) / 2;
        badge_y = qr_y + (qr_size - centre_badge_height) / 2;
        lx = qr_x + qr_size / 2;
        ly = qr_y + qr_size / 2;
        lz = base_thickness + qr_block_height + centre_badge_thickness;
        color(base_color)
            translate([badge_x, badge_y, base_thickness + qr_block_height])
                rounded_plate(centre_badge_width, centre_badge_height,
                    centre_badge_thickness,
                    min(2, centre_badge_width/2, centre_badge_height/2));
        color(label_color)
            translate([lx, ly, lz])
                linear_extrude(height=centre_text_height)
                    text(centre_label_text, size=centre_text_size,
                         halign="center", valign="center",
                         font="Liberation Sans:style=Bold");
    }`;

  return `// ============================================================
// Universal QR Code — Parametric 3D Print Model
// Generated: ${now}  |  Label: ${payeeName}
// Open in OpenSCAD > F6 > File > Export > STL
// ============================================================

qr_string            = "${escapeSCADStr(qrString)}";
base_length          = ${baseLength};
base_width           = ${baseWidth};
base_thickness       = ${baseThickness};
qr_size              = ${qrSize};
qr_block_height      = ${qrRaise};
apply_round_corner   = ${roundedCorners};
round_corner_radius  = ${cornerRadius};
add_keyring_hole     = ${keyringHole};
keyring_hole_diameter= ${holeDiameter};
keyring_tab_diameter = ${tabDiameter};
keyring_position     = ${keyringPosition};
show_centre_label    = ${centreLabel};
centre_label_text    = "${escapeSCADStr(centreLabelText)}";
centre_badge_width   = ${badgeWidth};
centre_badge_height  = ${badgeHeight};
centre_badge_thickness = 0.4;
centre_text_height   = 0.6;
centre_text_size     = ${textSize};
base_color  = [1, 1, 1];
qr_color    = [0, 0, 0];
label_color = [0, 0, 0];

module rounded_rect_2d(l,w,r){if(r<=0){square([l,w]);}else{hull(){translate([r,r])circle(r=r,$fn=64);translate([l-r,r])circle(r=r,$fn=64);translate([l-r,w-r])circle(r=r,$fn=64);translate([r,w-r])circle(r=r,$fn=64);}}}
module rounded_plate(l,w,t,r){linear_extrude(height=t)rounded_rect_2d(l,w,r);}

module qr_plate() {
    actual_l = max(base_length, qr_size + 8);
    actual_w = max(base_width,  qr_size + 8);
    qr_x = (actual_l - qr_size) / 2;
    qr_y = (actual_w - qr_size) / 2;
    cr   = apply_round_corner ? min(round_corner_radius, actual_l/2, actual_w/2) : 0;
    tab_x = keyring_position==1 ? actual_l+keyring_tab_diameter/2-keyring_tab_diameter*0.25
          : keyring_position==3 ? -keyring_tab_diameter/2+keyring_tab_diameter*0.25
          : actual_l/2;
    tab_y = keyring_position==0 ? actual_w+keyring_tab_diameter/2-keyring_tab_diameter*0.25
          : keyring_position==2 ? -keyring_tab_diameter/2+keyring_tab_diameter*0.25
          : actual_w/2;
    color(base_color)
        difference() {
            union() {
                rounded_plate(actual_l, actual_w, base_thickness, cr);
                if (add_keyring_hole)
                    translate([tab_x, tab_y, 0])
                        cylinder(h=base_thickness, d=keyring_tab_diameter, $fn=64);
            }
            if (add_keyring_hole)
                translate([tab_x, tab_y, -0.1])
                    cylinder(h=base_thickness+0.2, d=keyring_hole_diameter, $fn=64);
        }
    color(qr_color)
        translate([qr_x, qr_y, base_thickness])
            qr(message=qr_string, error_correction="H", width=qr_size, height=qr_size,
               thickness=qr_block_height, center=false, mask_pattern=0, encoding="UTF-8");
${centreBlock}
}

qr_plate();

// ==== scadqr library (embedded) ====
${scadqrLib}
`;
}

async function zipScadAndSvg(scadContent, svgContent, baseName) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const sink   = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
    });
    sink.on('finish', () => resolve(Buffer.concat(chunks)));

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', reject);
    archive.pipe(sink);
    archive.append(scadContent, { name: 'plate.scad' });
    archive.append(svgContent,  { name: 'logo.svg' });
    archive.finalize();
  });
}

async function buildSCAD(opts) {
  const { logoType, logoSvgContent, payeeName = 'qr' } = opts;
  const hasSvgLogo = logoType === 'svg' && !!logoSvgContent;
  const safeName   = payeeName
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/gi, '')
    .toLowerCase() || 'qr';

  const scadContent = buildSCADString({ ...opts, hasSvgLogo });

  if (hasSvgLogo) {
    const zipBuffer = await zipScadAndSvg(scadContent, logoSvgContent, safeName);
    return { content: zipBuffer, isZip: true, filename: `${safeName}_qr.zip` };
  }

  return { content: scadContent, isZip: false, filename: `${safeName}_qr.scad` };
}

module.exports = { buildSCAD };
