// esp32cam_bracket.scad: tilted mast that holds the ESP32-CAM upright,
// camera facing forward.
//
// The board plugs into two 8-pin "stacking" female headers (the kind with
// long ~11 mm tails, sold for Arduino shields). Their bodies sit in shallow
// pockets on the front of the mast; the tails pass through slots and stick
// out of the back, where the Dupont jumpers to the motor driver and power
// connect. The ESP32-CAM can be pulled out for USB flashing on an
// ESP32-CAM-MB. Glue the headers in with a drop of CA or hot glue.
//
// Mount: two M3 x 10 screws down through the foot and the deck, nuts below.
// Prints as exported, foot on the bed, no supports.

include <lib/telebot_common.scad>

print_orientation = true;

foot = [22, tower_w, 3.5];          // x, y, z
tower_x = 4;                        // tower starts this far in front of the screws
tower_h = cam_mast_h + esp_header_len + 6;
header_v0 = cam_mast_h + 3;         // bottom of the header pockets, up the mast

module tower_plate() {
    // local frame: front face at x = tower_t (normal +x), bottom at z = 0
    difference() {
        translate([0, -tower_w / 2, 0]) cube([tower_t, tower_w, tower_h]);
        for (s = [-1, 1]) {
            y = s * esp_header_pitch / 2;
            // locating pocket for the header body
            translate([tower_t - hdr_pocket_d, y - hdr_body_w / 2, header_v0 - 0.2])
                cube([hdr_pocket_d + 1, hdr_body_w, esp_header_len + 0.4]);
            // slot for the tails
            translate([-1, y - hdr_tail_w / 2, header_v0])
                cube([tower_t + 2, hdr_tail_w, esp_header_len]);
        }
        // lighten / pass wires between the header rows
        translate([-1, -6, 4]) cube([tower_t + 2, 12, cam_mast_h - 2]);
    }
}

module esp32cam_bracket() {
    difference() {
        union() {
            translate([-8, -foot[1] / 2, 0]) cube(foot);
            translate([tower_x, 0, foot[2] - 0.01]) rotate([0, -cam_tilt, 0]) tower_plate();
            // side gussets behind the tower, clear of the header tails
            for (s = [-1, 1]) translate([tower_x, s * (tower_w / 2 - 1.5) - 1.5, foot[2] - 0.01])
                rotate([90, 0, 0]) translate([0, 0, -3]) linear_extrude(3)
                    polygon([[0, 0], [-11, 0], [-tower_h * sin(cam_tilt) * 0.6, tower_h * 0.6]]);
        }
        for (s = [-1, 1]) translate([0, s * cam_mount_dy, -1]) cylinder(d = m3_d, h = foot[2] + 2);
    }
}

if (print_orientation) {
    esp32cam_bracket();
} else {
    translate([cam_x, 0, deck_t]) esp32cam_bracket();
}
