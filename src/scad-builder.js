/**
 * scad-builder.js — Generates parametric OpenSCAD (.scad) files
 * for 3D printing UPI QR code plates.
 *
 * The generated file is self-contained — it embeds the full scadqr library.
 * Open in OpenSCAD → F6 to render → File > Export > STL → slice & print.
 */

const fs = require('fs');
const path = require('path');

/**
 * Build the full OpenSCAD source string.
 * @param {Object} opts
 * @param {string}  opts.upiString         - Encoded upi://pay?... string
 * @param {string}  opts.payeeName         - Human-readable payee name
 * @param {string}  opts.upiId             - Raw UPI ID (for comments)
 * @param {number}  [opts.baseLength=90]   - Plate length mm
 * @param {number}  [opts.baseWidth=90]    - Plate width mm
 * @param {number}  [opts.baseThickness=2] - Plate thickness mm
 * @param {number}  [opts.qrSize=70]       - QR area size mm
 * @param {number}  [opts.qrRaise=0.8]     - Raised module height mm
 * @param {boolean} [opts.roundedCorners=false]
 * @param {number}  [opts.cornerRadius=4]
 * @param {boolean} [opts.keyringHole=false]
 * @param {number}  [opts.holeDiameter=5]
 * @param {number}  [opts.tabDiameter=12]
 * @param {number}  [opts.keyringPosition=0] - 0=Top 1=Right 2=Bottom 3=Left
 * @param {boolean} [opts.centreLabel=true]
 * @param {string}  [opts.centreLabelText='UPI']
 * @param {number}  [opts.badgeWidth=30]
 * @param {number}  [opts.badgeHeight=8]
 * @returns {string} Full .scad file content
 */
function buildSCAD(opts) {
  const {
    qrString,
    upiString,
    payeeName,
    upiId,
    baseLength      = 90,
    baseWidth       = 90,
    baseThickness   = 2,
    qrSize          = 70,
    qrRaise         = 0.8,
    roundedCorners  = false,
    cornerRadius    = 4,
    keyringHole     = false,
    holeDiameter    = 5,
    tabDiameter     = 12,
    keyringPosition = 0,
    centreLabel     = true,
    centreLabelText = 'UPI',
    badgeWidth      = 30,
    badgeHeight     = 8,
  } = opts;

  // Support both old (upiString) and new (qrString) API
  const qrData = qrString || upiString || '';

  const textSize = Math.round(badgeHeight * 0.55 * 10) / 10;
  const now = new Date().toISOString().slice(0, 10);

  const scadqrLib = fs.readFileSync(
    path.join(__dirname, '../scad/scadqr_library.scad'),
    'utf8'
  );

  const scadContent = `// ============================================================
// Universal QR Code — Parametric 3D Print Model
// Generated: ${now}
// Payee:     ${payeeName}
// UPI ID:    ${upiId}
//
// USAGE:
//   1. Open this file in OpenSCAD (free: openscad.org)
//   2. Press F6 to render (may take 1-2 minutes)
//   3. File > Export > Export as STL
//   4. Open STL in Cura / Bambu Studio / PrusaSlicer
//   5. Print!
//
// TWO-COLOUR TIP:
//   Print base in WHITE up to z = ${baseThickness}mm
//   Pause → swap to BLACK for raised QR modules
//
// RECOMMENDED PRINT SETTINGS:
//   Layer height : 0.15 mm
//   Infill       : 20%
//   Supports     : None
//   Material     : PLA
// ============================================================

/* [QR Content] */
upi_string = "${qrData}";

/* [Plate Dimensions (mm)] */
base_length     = ${baseLength};
base_width      = ${baseWidth};
base_thickness  = ${baseThickness};
qr_size         = ${qrSize};
qr_block_height = ${qrRaise};

/* [Options] */
apply_round_corner    = ${roundedCorners};
round_corner_radius   = ${cornerRadius};
add_keyring_hole      = ${keyringHole};
keyring_hole_diameter = ${holeDiameter};
keyring_tab_diameter  = ${tabDiameter};
keyring_position      = ${keyringPosition}; // 0=Top 1=Right 2=Bottom 3=Left

/* [Centre Label] */
show_centre_label       = ${centreLabel};
centre_label_text       = "${centreLabelText}";
centre_badge_width      = ${badgeWidth};
centre_badge_height     = ${badgeHeight};
centre_badge_thickness  = 0.4;
centre_text_height      = 0.6;
centre_text_size        = ${textSize};

/* [Colors — Preview Only, ignored when printing] */
base_color  = [1, 1, 1];   // White
qr_color    = [0, 0, 0];   // Black
label_color = [0, 0, 0];   // Black

/* [Hidden] */

// ---- Geometry helpers -----------------------------------------------

module rounded_rect_2d(l, w, r) {
    if (r <= 0) {
        square([l, w]);
    } else {
        hull() {
            translate([r,   r  ]) circle(r=r, $fn=64);
            translate([l-r, r  ]) circle(r=r, $fn=64);
            translate([l-r, w-r]) circle(r=r, $fn=64);
            translate([r,   w-r]) circle(r=r, $fn=64);
        }
    }
}

module rounded_plate(l, w, t, r) {
    linear_extrude(height=t)
        rounded_rect_2d(l, w, r);
}

// ---- Main plate -----------------------------------------------------

module upi_qr_plate() {
    actual_l = max(base_length, qr_size + 8);
    actual_w = max(base_width,  qr_size + 8);

    qr_x = (actual_l - qr_size) / 2;
    qr_y = (actual_w - qr_size) / 2;

    cr = apply_round_corner
         ? min(round_corner_radius, actual_l/2, actual_w/2)
         : 0;

    tab_overlap = keyring_tab_diameter * 0.25;

    tab_x = keyring_position == 1 ? actual_l + keyring_tab_diameter/2 - tab_overlap
          : keyring_position == 3 ? -keyring_tab_diameter/2 + tab_overlap
          : actual_l / 2;

    tab_y = keyring_position == 0 ? actual_w + keyring_tab_diameter/2 - tab_overlap
          : keyring_position == 2 ? -keyring_tab_diameter/2 + tab_overlap
          : actual_w / 2;

    // Base plate (subtract keyring hole if enabled)
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
                    cylinder(h=base_thickness + 0.2, d=keyring_hole_diameter, $fn=64);
        }

    // Raised QR modules
    color(qr_color)
        translate([qr_x, qr_y, base_thickness])
            qr(
                message          = upi_string,
                error_correction = "H",
                width            = qr_size,
                height           = qr_size,
                thickness        = qr_block_height,
                center           = false,
                mask_pattern     = 0,
                encoding         = "UTF-8"
            );

    // Centre label badge + text
    if (show_centre_label && centre_label_text != "") {
        badge_x = qr_x + (qr_size - centre_badge_width)  / 2;
        badge_y = qr_y + (qr_size - centre_badge_height) / 2;
        lx = qr_x + qr_size / 2;
        ly = qr_y + qr_size / 2;
        lz = base_thickness + qr_block_height + centre_badge_thickness;

        // White masking badge
        color(base_color)
            translate([badge_x, badge_y, base_thickness + qr_block_height])
                rounded_plate(
                    centre_badge_width,
                    centre_badge_height,
                    centre_badge_thickness,
                    min(2, centre_badge_width/2, centre_badge_height/2)
                );

        // Raised label text
        color(label_color)
            translate([lx, ly, lz])
                linear_extrude(height=centre_text_height)
                    text(
                        centre_label_text,
                        size   = centre_text_size,
                        halign = "center",
                        valign = "center",
                        font   = "Liberation Sans:style=Bold"
                    );
    }
}

// Render
upi_qr_plate();


// ====================================================================
// scadqr library (MIT License) — https://github.com/xypwn/scadqr
// Embedded below for self-contained file. DO NOT EDIT.
// ====================================================================

${scadqrLib}
`;

  const safeName = (payeeName || 'qr').replace(/\s+/g, '_').toLowerCase();
  return {
    content:  scadContent,
    isZip:    false,
    filename: `${safeName}_qr.scad`,
  };
}

module.exports = { buildSCAD };
