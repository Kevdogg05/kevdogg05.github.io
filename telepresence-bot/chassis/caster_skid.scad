// caster_skid.scad: ball-free rear support for hard floors (wood, tile,
// laminate). Same mounting as the caster holder: it slides over the post
// under the deck and takes the same two pins.
//
// Saves the ball, but drags on carpet and rugs; use the ball caster there.
// About a third of the robot's weight rests on it, so print it in PETG or
// PLA and sand the dome smooth; a drop of silicone or PTFE dry lube helps.
//
// Prints flange-down as exported, dome on top, no supports.

include <lib/telebot_common.scad>

print_orientation = true;
dome_r = 14;                // large radius: slides over grout lines and thresholds

skid_bottom = -ground_clear;                          // touches the floor
dome_join = skid_bottom + dome_r - sqrt(pow(dome_r, 2) - pow(caster_od / 2, 2));
post_end = caster_ball_z + 0.6 * caster_ball_d / 2;   // matches caster_post() in chassis_base.scad

module caster_skid() {
    difference() {
        union() {
            caster_flange();
            translate([caster_x, 0, dome_join]) cylinder(d = caster_od, h = -dome_join);
            intersection() {
                translate([caster_x, 0, skid_bottom + dome_r]) sphere(r = dome_r, $fn = 96);
                translate([caster_x, 0, skid_bottom]) cylinder(d = caster_od, h = dome_join - skid_bottom + 0.01);
            }
        }
        // the deck's post slides into this bore
        translate([caster_x, 0, post_end - 0.5]) cylinder(d = caster_bore_d, h = -post_end + 1.5);
        caster_mount_holes();
    }
}

if (print_orientation) {
    rotate([180, 0, 0]) translate([-caster_x, 0, 0]) caster_skid();
} else {
    caster_skid();
}
