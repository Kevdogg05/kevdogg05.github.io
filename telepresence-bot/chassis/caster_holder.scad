// caster_holder.scad: ball caster for a 16 mm glass marble or 5/8" steel ball.
//
// Assembly: drop the ball into the bore, slide the holder over the caster
// post under the deck, and fix it with two M3 x 10 screws from the top of the
// deck. The throat at the bottom keeps the ball in; the post is its seat.
//
// Prints flange-down as exported (no supports). The narrowing near the throat
// is a gentle overhang that prints fine at 0.2 mm layers.

include <lib/telebot_common.scad>

print_orientation = true;

throat_r = sqrt(pow(caster_bore_d / 2, 2) - pow(caster_ball_z - caster_bottom_z, 2));
assert(2 * throat_r < caster_ball_d * 0.9, "throat too wide to keep the ball in: reduce caster_floor_gap");
assert(caster_seat_z < -caster_flange_t - 5, "caster post too short: use a smaller ball or a taller stance");

module caster_holder() {
    boss_d = 7.5;
    boss_h = 8;
    difference() {
        union() {
            // flange against the deck underside
            translate([caster_x, 0, -caster_flange_t / 2])
                cube([14, 2 * caster_mount_dy + boss_d, caster_flange_t], center = true);
            // screw bosses
            for (s = [-1, 1]) translate([caster_x, s * caster_mount_dy, -boss_h]) cylinder(d = boss_d, h = boss_h);
            // column
            translate([caster_x, 0, caster_bottom_z]) cylinder(d = caster_od, h = -caster_bottom_z);
        }
        // bore for the post and the ball, down to the ball's centre
        translate([caster_x, 0, caster_ball_z]) cylinder(d = caster_bore_d, h = -caster_ball_z + 1);
        // lower half of the ball cavity, ending in the throat
        translate([caster_x, 0, caster_ball_z]) sphere(d = caster_bore_d, $fn = 64);
        translate([caster_x, 0, caster_bottom_z - 1]) cylinder(r = throat_r, h = 2);
        // self-tapping holes for the M3 screws
        for (s = [-1, 1]) translate([caster_x, s * caster_mount_dy, -boss_h - 1]) cylinder(d = m3_tap_d, h = boss_h + 2);
    }
}

if (print_orientation) {
    // flange on the bed, centred on the origin
    translate([0, 0, 0]) rotate([180, 0, 0]) translate([-caster_x, 0, 0]) caster_holder();
} else {
    caster_holder();
}
