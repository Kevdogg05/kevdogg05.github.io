// assembly.scad: preview of the assembled robot with reference models of the
// bought parts (motors, wheels, battery, ESP32-CAM, caster ball). For
// checking fit, not for printing.
//
// The reference models are approximate; printed parts come from the other
// .scad files in this folder.

include <lib/telebot_common.scad>
use <chassis_base.scad>
use <caster_holder.scad>
use <esp32cam_bracket.scad>
use <wheel.scad>
use <push_pin.scad>

explode = 0;            // set to e.g. 15 to pull the parts apart
printed_wheels = true;  // false: bought TT wheels

color("lightgray") chassis_base();
color("orange") translate([0, 0, -explode]) caster_holder();
color("orange") translate([cam_x, 0, deck_t + explode]) esp32cam_bracket();

// motors and wheels
for (s = [-1, 1]) mirror([0, s < 0 ? 1 : 0, 0]) {
    translate([axle_x, motor_y_out, axle_z - explode]) tt_motor_model();
    if (printed_wheels)
        translate([axle_x, motor_y_out, axle_z - explode]) rotate([-90, 0, 0]) wheel_with_tires();
    else
        translate([axle_x, motor_y_out + wheel_gap, axle_z - explode]) wheel_model();
}

// push pins: two through the camera bracket, two through the caster flange
color("white") for (s = [-1, 1]) {
    translate([cam_x, s * cam_mount_dy, deck_t + 3.5 + 2 * explode]) rotate([180, 0, 0]) pin_upright();
    translate([caster_x, s * caster_mount_dy, deck_t + explode]) rotate([180, 0, 0]) pin_upright();
}

// caster ball
color("lightblue", 0.8) translate([caster_x, 0, caster_ball_z - 2 * explode]) sphere(d = caster_ball_d);

// battery
translate([batt_x, 0, deck_t + explode]) battery_model();

// ESP32-CAM on its headers (tilted with the mast)
translate([cam_x + 4, 0, deck_t + 3.5 + 2 * explode]) rotate([0, -cam_tilt, 0])
    translate([tower_t + 7, 0, cam_mast_h + 3 - 1.3]) esp32cam_model();

// floor
%translate([0, 0, -ground_clear - 0.5]) cube([200, 200, 1], center = true);
