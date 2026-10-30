// telebot_common.scad: shared dimensions and modules for the TeleBot chassis.
//
// Coordinates (assembled robot): x forward, y left, z up, millimetres.
// z = 0 is the UNDERSIDE of the deck; the floor is at z = -ground_clear.
//
// Measure your parts before printing. TT gear motors in particular vary a
// little between sellers: check tt_t and tt_h with calipers.

$fn = 48;

// ---------------------------------------------------------------- printing
clr = 0.3;      // sliding/locating clearance per side
m3_d = 3.4;     // M3 clearance hole
m3_tap_d = 2.6; // M3 screw self-tapping into plastic
m3_nut_af = 5.7; // M3 nut across flats, plus clearance

// ---------------------------------------------------------------- deck
deck_l = 140;   // length (x)
deck_w = 100;   // width (y): the motors sit flush with the side edges
deck_t = 3;     // thickness
deck_r = 14;    // corner radius

// ---------------------------------------------------------------- TT gear motor (yellow, 1:48, in-line)
tt_t = 18.8;    // gearbox thickness along the axle (y)
tt_h = 22.4;    // gearbox height (z)
tt_len = 70;    // front of gearbox to back of motor can (x)
tt_nose = 11.3; // axle centre to the rounded front of the gearbox
tt_can_d = 20;  // motor can diameter
tt_shaft_l = 9; // output shaft length beyond each face of the gearbox
// Optional bolt slots in the inner wall for the gearbox's two M3 through-holes.
// Off by default: hole positions vary between sellers. Measure, then enable.
tt_bolt_slots = false;
tt_bolt_dx = 20.5;  // holes are this far behind the axle...
tt_bolt_dz = 17.5;  // ...and this far apart vertically, centred on the axle

// ---------------------------------------------------------------- wheels and stance
wheel_d = 65;
wheel_w = 26;
axle_x = 20;                    // axle position along the deck
axle_z = -tt_h / 2;             // gearbox top rests against the deck underside
ground_clear = wheel_d / 2 - axle_z;   // deck underside height above the floor (~43.7)
motor_y_out = deck_w / 2;       // outer face of the gearbox, flush with the deck edge
motor_y_in = motor_y_out - tt_t;

// ---------------------------------------------------------------- motor saddle (under the deck)
wall_t = 4;                     // inner wall thickness
wall_drop = tt_h + 2;           // how far the wall hangs below the deck
wall_x0 = axle_x - tt_len + tt_nose - 2;   // from just behind the motor can...
wall_x1 = axle_x + tt_nose + clr + 3;      // ...to past the front stop
zip_x = axle_x - 53;            // motor zip tie: over the can, clear of the wheel and battery ties

// ---------------------------------------------------------------- caster
// The ball drops into the holder from the top and is retained by a throat at
// the bottom; a post under the deck closes the top and is the ball's seat.
caster_x = -56;
caster_ball_d = 16;             // 16 mm glass marble or 5/8" (15.9 mm) steel ball
caster_ball_clr = 0.6;          // diametral clearance around the ball
caster_wall = 3;
caster_mount_dy = 12;           // M3 screws at y = +/- this
caster_floor_gap = 3;           // holder bottom stays this far above the floor
caster_flange_t = 3;
caster_ball_z = -ground_clear + caster_ball_d / 2;              // ball centre
caster_bottom_z = -ground_clear + caster_floor_gap;             // holder bottom
caster_seat_z = caster_ball_z + caster_ball_d / 2 + 0.2;        // post end = ball seat
caster_bore_d = caster_ball_d + caster_ball_clr;
caster_od = caster_bore_d + 2 * caster_wall;

// ---------------------------------------------------------------- ESP32-CAM bracket
cam_x = 44;                     // bracket mounting screws on the deck centre line
cam_mount_dy = 12;
cam_tilt = 10;                  // camera looks up by this many degrees
cam_mast_h = 12;                // extra height under the board (raise for a taller view)
esp_header_pitch = 22.86;       // ESP32-CAM header rows are 0.9" apart
esp_header_len = 20.32;         // 8 pins x 2.54 mm
hdr_body_w = 2.6;               // female header body cross-section (+ clearance)
hdr_pocket_d = 1.5;             // locating pocket depth for the header bodies
hdr_tail_w = 1.2;               // slot for the long tails of stacking headers
tower_t = 5;                    // tower plate thickness
tower_w = 34;

// ---------------------------------------------------------------- battery and electronics
batt_x = -15;                   // 18650 holder centre (behind the axle keeps the weight on the wheels)
batt_holder = [21, 78, 20];     // single 18650 holder footprint (x, y) and height
elec_x0 = -64;                  // perforated area for the driver and power modules
elec_x1 = -34;
wire_hole_x = axle_x - tt_len + tt_nose - 6;  // motor leads come up behind the cans
wire_hole_y = 38;
wire_hole_d = 8;
switch_cut = [13.2, 8.9];       // KCD11-style mini rocker switch (panel cutout)
switch_pos = [-62, -34];

// ================================================================= helpers
module rounded_rect(size, r) {
    // 2D rounded rectangle centred on the origin
    offset(r = r) square([size[0] - 2 * r, size[1] - 2 * r], center = true);
}

module slot(len, w, h) {
    // 3D stadium slot along x, centred, height h (z)
    hull() {
        for (s = [-1, 1]) translate([s * (len - w) / 2, 0, 0]) cylinder(d = w, h = h, center = true);
    }
}

module zip_slot(h = 20) {
    // slot for a 2.5 mm zip tie (long side along x)
    cube([4.2, 2.2, h], center = true);
}

// ================================================================= reference models (assembly preview only)
module tt_motor_model() {
    // axle at the origin, body extending toward -x, outer face at y = 0, inner face at y = -tt_t
    gear_len = tt_len - 27;     // gearbox length; the remaining 27 mm is the motor can
    color("gold") {
        translate([tt_nose - gear_len, -tt_t, -tt_h / 2]) cube([gear_len - tt_nose, tt_t, tt_h]);
        translate([0, -tt_t, 0]) rotate([-90, 0, 0]) cylinder(d = tt_h, h = tt_t);   // rounded nose
    }
    color("silver") translate([-tt_len + tt_nose, -tt_t / 2, 0]) rotate([0, 90, 0]) cylinder(d = tt_can_d, h = 27);
    color("white") translate([0, -tt_t - tt_shaft_l, 0]) rotate([-90, 0, 0]) cylinder(d = 5.4, h = tt_t + 2 * tt_shaft_l);
}

module wheel_model() {
    // centred on the axle, inner face at y = 0, extending to +y
    color("dimgray") rotate([-90, 0, 0]) difference() {
        cylinder(d = wheel_d, h = wheel_w);
        translate([0, 0, -1]) cylinder(d = wheel_d - 16, h = 4);
    }
}

module esp32cam_model() {
    // board standing on its 5V end, camera side toward +x, origin at the bottom centre of the back face
    color("darkgreen") translate([0, -13.5, 0]) cube([1.6, 27, 40.5]);
    color("black") translate([1.6, -4, 26]) cube([4.5, 8, 8]);              // camera module
    color("silver") translate([1.6, -9, 7]) cube([3.2, 18, 25]);            // ESP32-S shield
    color("black") for (s = [-1, 1]) translate([-2.5, s * esp_header_pitch / 2 - 1.25, 1.3]) cube([2.5, 2.5, esp_header_len]);
}

module battery_model() {
    color("royalblue") translate([-batt_holder[0] / 2, -batt_holder[1] / 2, 0]) cube(batt_holder);
    color("steelblue") translate([0, -65 / 2, batt_holder[2] / 2 + 1]) rotate([-90, 0, 0]) cylinder(d = 18.4, h = 65);
}
