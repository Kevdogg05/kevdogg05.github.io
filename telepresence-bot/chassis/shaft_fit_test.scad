// shaft_fit_test.scad: find the right bore for your TT motor shafts before
// printing wheels. Takes about 10 minutes and 2 g.
//
// Four short hubs with the double-D bore at increasing clearance (per side):
//   1 notch = 0.05 mm, 2 = 0.10, 3 = 0.15, 4 = 0.20
// Push each onto a motor shaft. Pick the tightest one that goes on fully by
// hand without cracking, and set shaft_clr in lib/telebot_common.scad to it.
// Print with the same printer, material and settings as the wheels.

include <lib/telebot_common.scad>

clearances = [0.05, 0.10, 0.15, 0.20];
hub_d = 13;
hub_h = tt_shaft_l;
pitch = 17;

difference() {
    union() {
        for (i = [0 : len(clearances) - 1]) translate([i * pitch, 0, 0]) cylinder(d = hub_d, h = hub_h);
        // tie bar, so the coupons print and stay together as one part
        translate([0, -1, 0]) cube([(len(clearances) - 1) * pitch, 2, 1.2]);
    }
    for (i = [0 : len(clearances) - 1]) translate([i * pitch, 0, 0]) {
        translate([0, 0, -0.01]) double_d(clearances[i], hub_h + 1);
        // notches on the rim: count = position in the list
        for (n = [0 : i]) rotate(90 + n * 22) translate([hub_d / 2, 0, hub_h - 1.5]) cube([2, 1.2, 4], center = true);
    }
}
