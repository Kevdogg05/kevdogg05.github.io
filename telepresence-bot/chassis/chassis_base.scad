// chassis_base.scad: TeleBot deck with integrated TT motor saddles and the
// caster seat post.
//
// Print upside down (the default output): the deck's top face goes on the
// bed, so the motor walls and the caster post grow straight up. No supports.
// PLA or PETG, 0.2 mm layers, 3 walls, 25 % infill. About 70 g.
//
// Each motor sits between the deck, its inner wall and a front stop, and is
// held by one zip tie that wraps the motor can and the deck edge.

include <lib/telebot_common.scad>

print_orientation = true;   // false: assembled orientation (used by assembly.scad)

module deck_plate() {
    difference() {
        linear_extrude(deck_t) rounded_rect([deck_l, deck_w], deck_r);

        // ESP32-CAM bracket screws (M3 + nut under the deck)
        for (s = [-1, 1]) translate([cam_x, s * cam_mount_dy, 0]) cylinder(d = m3_d, h = 3 * deck_t, center = true);
        // Caster holder screws (M3 x 10, self-tapping into the holder)
        for (s = [-1, 1]) translate([caster_x, s * caster_mount_dy, 0]) cylinder(d = m3_d, h = 3 * deck_t, center = true);

        // Motor zip ties: down just inside each wall, around the motor can and the deck edge
        for (s = [-1, 1]) translate([zip_x, s * (motor_y_in - clr - wall_t - 1.6), deck_t / 2]) zip_slot();

        // Battery holder: two zip ties across it
        for (sx = [-1, 1], sy = [-1, 1])
            translate([batt_x + sx * (batt_holder[0] / 2 + 2), sy * 22, deck_t / 2]) rotate(90) zip_slot();

        // Motor leads come up behind the motor cans
        for (s = [-1, 1]) translate([wire_hole_x, s * wire_hole_y, 0]) cylinder(d = wire_hole_d, h = 3 * deck_t, center = true);

        // Electronics area: 10 mm grid of M3 holes for screws, standoffs or zip ties
        for (x = [-46, -36], y = [-20 : 10 : 20]) translate([x, y, 0]) cylinder(d = m3_d, h = 3 * deck_t, center = true);

        // Power switch
        translate([switch_pos[0], switch_pos[1], 0]) cube([switch_cut[1], switch_cut[0], 3 * deck_t], center = true);

    }
}

// One motor saddle, built for the left side (+y) and mirrored for the right.
module motor_saddle() {
    wall_y = motor_y_in - clr - wall_t;   // inner face of the wall (toward the centre)
    difference() {
        union() {
            // inner wall
            translate([wall_x0, wall_y, -wall_drop]) cube([wall_x1 - wall_x0, wall_t, wall_drop + 0.01]);
            // front stop: catches the rounded nose of the gearbox at axle height
            translate([axle_x + tt_nose + clr, wall_y, -tt_h * 0.75]) cube([3, wall_t + clr + 8, tt_h * 0.75 + 0.01]);
            // ribs on the inside of the wall
            for (x = [wall_x0 + 2, axle_x - 22, wall_x1 - 5])
                translate([x, wall_y + 0.01, 0]) rotate([90, 0, 90]) linear_extrude(3)
                    polygon([[0, 0], [-8, 0], [0, -wall_drop * 0.8]]);
        }
        // notch so the zip tie pulls the motor (not the wall) up against the deck
        translate([zip_x, wall_y + wall_t / 2, -wall_drop]) cube([5, wall_t + 2, 2 * (wall_drop - tt_h) + 0.6], center = true);
        // optional bolt slots for the gearbox's own through-holes
        if (tt_bolt_slots)
            for (dz = [-1, 1])
                translate([axle_x - tt_bolt_dx, wall_y + wall_t / 2, axle_z + dz * tt_bolt_dz / 2])
                    rotate([90, 0, 0]) slot(6, m3_d, wall_t + 2);
    }
}

module caster_post() {
    // Fits inside the caster holder's bore; its concave end is the ball's seat.
    end_z = caster_ball_z + 0.6 * caster_ball_d / 2;
    difference() {
        translate([caster_x, 0, end_z]) cylinder(d = caster_bore_d - 2 * clr, h = -end_z + 0.01);
        translate([caster_x, 0, caster_ball_z]) sphere(d = caster_ball_d + 0.4, $fn = 64);
    }
}

module chassis_base() {
    deck_plate();
    motor_saddle();
    mirror([0, 1, 0]) motor_saddle();
    caster_post();
}

if (print_orientation) {
    // top face on the bed
    translate([0, 0, deck_t]) rotate([180, 0, 0]) chassis_base();
} else {
    chassis_base();
}
