// tire_tpu.scad: optional printed tire for wheel.scad with tire = "tpu".
//
// For people who already have TPU. Printed 95A TPU grips noticeably less than
// a rubber O-ring or a cast silicone tire, so the O-ring wheel is the default.
// Stretch the tire over one lip of the rim into the channel.
//
// Print flat as exported, 95A TPU, slow (20-25 mm/s), 100 % infill. Print two.

include <lib/telebot_common.scad>

stretch = 0.02;             // tire inner diameter is 2 % smaller than the channel
tread_grooves = 30;
tread_depth = 0.7;

channel_r = wheel_d / 2 - tpu_tire_t;
tire_w = pw_width - 2 * 1.5 - 0.4;   // channel width (rim minus lips) less clearance

module tire_tpu() {
    difference() {
        cylinder(r = wheel_d / 2, h = tire_w, $fn = 160);
        translate([0, 0, -1]) cylinder(r = channel_r * (1 - stretch), h = tire_w + 2, $fn = 160);
        // shallow chevron-free tread: straight grooves across the face
        for (i = [0 : tread_grooves - 1]) rotate(i * 360 / tread_grooves)
            translate([wheel_d / 2 - tread_depth, -0.6, 1.2]) cube([tread_depth + 1, 1.2, tire_w - 2.4]);
    }
}

tire_tpu();
