// wheel.scad: 65 mm drive wheel for the TT gear motor's double-D shaft.
//
// Replaces the wheel in a "TT motor + wheel" set, so you can buy bare motors.
// Print the rigid wheel in PLA or PETG and give it a soft tire: printed PLA
// has almost no grip on smooth floors.
//
//   tire = "oring"  two grooves for 55 x 3.5 mm NBR O-rings (or wide rubber
//                   bands). Best grip for the money.
//   tire = "tpu"    one channel for the printed tire in tire_tpu.scad.
//
// Print first: shaft_fit_test.scad, then set shaft_clr in
// lib/telebot_common.scad to the bore that slid on snugly.
//
// Prints as exported: outer face on the bed, no supports. Print two.
// 0.2 mm layers, 3 walls, 30 % infill, about 13 g each.

include <lib/telebot_common.scad>

tire = "oring";             // "oring" or "tpu"
screw_hole = true;          // M2 self-tapping screw into the shaft's centre hole (optional)
print_orientation = true;

hub_d = 13;
spacer_d = 9;               // presses on the gearbox's bearing boss, keeps the rim off the chassis
web_t = 2.4;                // spoke disc on the outer face
rim_wall = 1.6;             // material left under the deepest groove
bore_depth = tt_shaft_l + 0.5;

// O-ring geometry: grooves with 45-degree flanks print without supports.
oring_stretched = oring_cs * 0.975;                  // ~5 % stretch thins the cord slightly
groove_bottom_r = wheel_d / 2 - oring_stretched;     // cord sits on the groove bottom
groove_depth = oring_cs * 0.6;
groove_floor_w = oring_cs * 0.85;

// TPU mode: a channel between two retaining lips.
tpu_lip = 1.5;
tpu_lip_h = 1.2;
channel_r = wheel_d / 2 - tpu_tire_t;

rim_r = tire == "oring" ? groove_bottom_r + groove_depth : channel_r + tpu_lip_h;
rim_in_r = (tire == "oring" ? groove_bottom_r : channel_r) - rim_wall;
z_out = wheel_gap + pw_width;    // outer face; z = 0 is the spacer face against the gearbox

assert(rim_in_r > hub_d / 2 + 8, "wheel too small for the hub and spokes");

module groove_cutter(zc) {
    // trapezoid revolved around the axle: floor width groove_floor_w, 45-degree flanks
    top_w = groove_floor_w + 2 * groove_depth;
    rotate_extrude($fn = 120) polygon([
        [groove_bottom_r, zc - groove_floor_w / 2],
        [rim_r + 0.01, zc - top_w / 2 - 0.01],
        [rim_r + 1, zc - top_w / 2 - 0.01],
        [rim_r + 1, zc + top_w / 2 + 0.01],
        [rim_r + 0.01, zc + top_w / 2 + 0.01],
        [groove_bottom_r, zc + groove_floor_w / 2],
    ]);
}

module wheel() {
    difference() {
        union() {
            // rim
            translate([0, 0, wheel_gap]) difference() {
                cylinder(r = rim_r, h = pw_width, $fn = 120);
                translate([0, 0, -1]) cylinder(r = rim_in_r, h = pw_width + 2, $fn = 120);
            }
            // spoke disc on the outer face
            translate([0, 0, z_out - web_t]) cylinder(r = rim_in_r + 0.5, h = web_t, $fn = 120);
            // hub and gearbox spacer
            translate([0, 0, wheel_gap]) cylinder(d = hub_d, h = pw_width);
            cylinder(d = spacer_d, h = wheel_gap + 0.01);
            // gussets from hub to disc
            for (a = [0 : 60 : 359]) rotate(a)
                translate([hub_d / 2 - 0.5, -1, z_out - web_t - 6]) cube([6, 2, 6 + 0.01]);
        }
        // shaft
        translate([0, 0, -0.01]) double_d(shaft_clr, bore_depth);
        translate([0, 0, -0.01]) cylinder(d1 = tt_shaft_d + 2 * shaft_clr + 0.8, d2 = tt_shaft_d, h = 0.6);  // lead-in
        if (screw_hole) {
            translate([0, 0, bore_depth - 0.1]) cylinder(d = 2.2, h = z_out);
            translate([0, 0, z_out - 2]) cylinder(d = 4.6, h = 3);
        }
        // lightening holes between six spokes at least 4 mm wide
        mid_r = (rim_in_r + hub_d / 2) / 2;
        hole_r = min((2 * mid_r * sin(30) - 4) / 2, (rim_in_r - hub_d / 2) / 2 - 2.5);
        for (a = [30 : 60 : 359]) rotate(a)
            translate([mid_r, 0, z_out - web_t - 1]) cylinder(r = hole_r, h = web_t + 2);
        // tire seats
        if (tire == "oring") {
            for (f = [0.27, 0.73]) groove_cutter(wheel_gap + f * pw_width);
        } else {
            translate([0, 0, wheel_gap + tpu_lip]) difference() {
                cylinder(r = rim_r + 1, h = pw_width - 2 * tpu_lip, $fn = 120);
                translate([0, 0, -1]) cylinder(r = channel_r, h = pw_width, $fn = 120);
            }
        }
    }
}

// Assembly preview: the wheel with its O-rings, axle along +z from the gearbox face.
module wheel_with_tires() {
    color("orange") wheel();
    if (tire == "oring")
        color("black") for (f = [0.27, 0.73]) translate([0, 0, wheel_gap + f * pw_width])
            rotate_extrude($fn = 96) translate([groove_bottom_r + oring_stretched / 2, 0]) circle(d = oring_stretched, $fn = 24);
}

if (print_orientation) {
    translate([0, 0, z_out]) rotate([180, 0, 0]) wheel();
} else {
    wheel();
}
