// ============================================================
// Example: UPI QR code plate
// Replace upi_string with your own UPI deep-link.
// ============================================================

include <scadqr_library.scad>

// Your UPI payment string
upi_string = "upi://pay?pa=yourname@upi&pn=Your%20Shop&cu=INR";

// Plate size (mm)
base_length    = 90;
base_width     = 90;
base_thickness = 2;

// QR area
qr_size          = 70;
qr_block_height  = 0.8;

// Optional features
apply_round_corner   = true;
round_corner_radius  = 5;
add_keyring_hole     = false;

// Centre label
show_centre_label      = true;
centre_label_text      = "UPI";
centre_badge_width     = 30;
centre_badge_height    = 8;
centre_badge_thickness = 0.4;
centre_text_height     = 0.6;
centre_text_size       = 4.4;

base_color  = [1, 1, 1];
qr_color    = [0, 0, 0];
label_color = [0, 0, 0];

module rounded_rect_2d(l, w, r) {
    if (r <= 0) { square([l, w]); }
    else { hull() {
        translate([r,   r  ]) circle(r=r, $fn=64);
        translate([l-r, r  ]) circle(r=r, $fn=64);
        translate([l-r, w-r]) circle(r=r, $fn=64);
        translate([r,   w-r]) circle(r=r, $fn=64);
    }}
}

module rounded_plate(l, w, t, r) {
    linear_extrude(height=t) rounded_rect_2d(l, w, r);
}

module upi_qr_plate() {
    actual_l = max(base_length, qr_size + 8);
    actual_w = max(base_width,  qr_size + 8);
    qr_x = (actual_l - qr_size) / 2;
    qr_y = (actual_w - qr_size) / 2;
    cr = apply_round_corner ? min(round_corner_radius, actual_l/2, actual_w/2) : 0;

    color(base_color)
        rounded_plate(actual_l, actual_w, base_thickness, cr);

    color(qr_color)
        translate([qr_x, qr_y, base_thickness])
            qr(message=upi_string, error_correction="H",
               width=qr_size, height=qr_size,
               thickness=qr_block_height, center=false,
               mask_pattern=0, encoding="UTF-8");

    if (show_centre_label && centre_label_text != "") {
        badge_x = qr_x + (qr_size - centre_badge_width) / 2;
        badge_y = qr_y + (qr_size - centre_badge_height) / 2;
        lz = base_thickness + qr_block_height + centre_badge_thickness;

        color(base_color)
            translate([badge_x, badge_y, base_thickness + qr_block_height])
                rounded_plate(centre_badge_width, centre_badge_height,
                              centre_badge_thickness,
                              min(2, centre_badge_width/2, centre_badge_height/2));

        color(label_color)
            translate([qr_x + qr_size/2, qr_y + qr_size/2, lz])
                linear_extrude(height=centre_text_height)
                    text(centre_label_text, size=centre_text_size,
                         halign="center", valign="center",
                         font="Liberation Sans:style=Bold");
    }
}

upi_qr_plate();
