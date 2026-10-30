// caster_holder.scad: ball caster for a 16 mm glass marble or 5/8" steel ball.
//
// Assembly: drop the ball into the bore, slide the holder over the caster
// post under the deck, and fix it with two printed push pins (push_pin.scad)
// or M3 x 10 screws and nuts. The throat at the bottom keeps the ball in; the
// post is its seat. For hard floors only, caster_skid.scad needs no ball.
//
// Prints flange-down as exported (no supports). The narrowing near the throat
// is a gentle overhang that prints fine at 0.2 mm layers.

include <lib/telebot_common.scad>

print_orientation = true;

throat_r = sqrt(pow(caster_bore_d / 2, 2) - pow(caster_ball_z - caster_bottom_z, 2));
assert(2 * throat_r < caster_ball_d * 0.9, "throat too wide to keep the ball in: reduce caster_floor_gap");
assert(caster_seat_z < -caster_flange_t - 5, "caster post too short: use a smaller ball or a taller stance");
assert(caster_mount_dy - pin_hole_d / 2 - 0.6 > caster_od / 2, "mounting holes run into the column");

module caster_holder() {
    difference() {
        union() {
            caster_flange();
            translate([caster_x, 0, caster_bottom_z]) cylinder(d = caster_od, h = -caster_bottom_z);
        }
        // bore for the post and the ball, down to the ball's centre
        translate([caster_x, 0, caster_ball_z]) cylinder(d = caster_bore_d, h = -caster_ball_z + 1);
        // lower half of the ball cavity, ending in the throat
        translate([caster_x, 0, caster_ball_z]) sphere(d = caster_bore_d, $fn = 64);
        translate([caster_x, 0, caster_bottom_z - 1]) cylinder(r = throat_r, h = 2);
        caster_mount_holes();
    }
}

if (print_orientation) {
    // flange on the bed, centred on the origin
    rotate([180, 0, 0]) translate([-caster_x, 0, 0]) caster_holder();
} else {
    caster_holder();
}
