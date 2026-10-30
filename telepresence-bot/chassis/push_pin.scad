// push_pin.scad: printed snap pins that replace the four M3 screws and two
// nuts (camera bracket and caster holder), so no fastener kit is needed.
//
// Push a pin down through the part and the deck until the barbs click under
// the lower face. To remove, squeeze the two prongs together from below.
// The joints carry almost no load: the caster pushes up into the deck, and
// the bracket only holds a 10 g board.
//
// Prints lying flat as exported, so the prongs bend within a layer instead of
// across layer lines. PETG is best; PLA works. 0.12-0.16 mm layers, 100 %
// infill. Six pins: four used, two spares.

include <lib/telebot_common.scad>

count = 6;
pin_t = 2.8;                // printed thickness (the flats); must stay under the shank diameter
shank_d = pin_hole_d - 0.2; // 3.2 in a 3.4 hole
barb_d = pin_hole_d + 0.6;  // 4.0: catches under the hole edge
head_d = 7.2;
head_h = 1.8;
slot_w = 1.0;
taper = 3.2;

shoulder = head_h + pin_grip + 0.2;
pin_len = shoulder + 0.3 + taper;
slot_len = pin_len - shoulder + 3.5;

assert(pin_t < shank_d, "the pin must be thinner than its shank to fit the round hole");
assert(barb_d - shank_d <= slot_w, "the prongs cannot close far enough to pass the hole");

module pin_upright() {
    // axis along +z from the head (z = 0) to the tip
    difference() {
        intersection() {
            rotate_extrude($fn = 48) polygon([
                [0, 0], [head_d / 2, 0], [head_d / 2, head_h], [shank_d / 2, head_h],
                [shank_d / 2, shoulder], [barb_d / 2, shoulder], [barb_d / 2, shoulder + 0.3],
                [shank_d / 2 - 0.5, pin_len], [0, pin_len],
            ]);
            translate([0, 0, pin_len / 2]) cube([head_d + 1, pin_t, pin_len + 1], center = true);
        }
        // split: two prongs that flex toward each other
        translate([0, 0, pin_len - slot_len / 2 + 0.5]) cube([slot_w, pin_t + 1, slot_len + 1], center = true);
        translate([0, 0, pin_len - slot_len]) rotate([90, 0, 0]) cylinder(d = slot_w, h = pin_t + 1, center = true, $fn = 24);
    }
}

for (i = [0 : count - 1]) translate([i * (head_d + 3), 0, pin_t / 2]) rotate([90, 0, 0]) pin_upright();
