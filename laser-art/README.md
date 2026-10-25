# laser-art: photo → two-tone layered wood portrait

Research notes and a working prototype for turning a photo into the kind of
"light wood figure on dark walnut" portrait that laser shops (Snip Art and
others) sell, and for finding out how far the artwork can be simplified before
it stops looking like the finished piece.

Target machine: xTool S1 (20 W / 40 W diode), but nothing here is S1-specific.

---

## 1. How the reference piece is actually built

Reading the production video frame by frame:

| Frame | What is happening | What it tells us |
|---|---|---|
| Laser writing the name | Cutting script text out of a **light** sheet | Top layer is a light, fine-grained wood (basswood / beech / maple veneer) |
| Wiping the engraved panel with a cloth | Removing soot from **scored lines** | Fine detail (beard, hair strands, fabric folds, lettering outlines) is a low-power vector *score*, not a cut |
| Lifting out a piece with a pointed tool | **Weeding** the dark regions | Dark areas are the light layer *removed* so the walnut backer shows through |
| Tilted panel showing the edge | Thin light sheet sitting proud of a thicker dark panel | Two layers, light on top of dark, total ~3–4 mm |
| Final piece | Framed, light border all round | The light sheet is one piece: border + figure, with the dark "window" cut out of it |

So the piece has exactly **three tones**, produced by **two operations** on **one sheet**:

1. **Light wood** (untouched top layer) = skin highlights, shirt, teeth, frame border.
2. **Dark wood** (top layer cut away, walnut showing) = background, hair, sunglasses, shadows, the dark half of the shirt.
3. **Scored line** (shallow burn into the light layer) = thin dark detail that is too fine to cut out.

Two ways to assemble it:

- **A. Pre-laminated (what the video shows).** Glue a ~0.6–1.5 mm light veneer onto a 3 mm walnut-faced panel *first*, then cut only through the top layer and weed the dark areas out. Light "islands" (the letters of ACTIVE, the bridge of the sunglasses, eye highlights) stay put because they are already glued down. This is why the reference can have so many floating light pieces. Needs a depth-controlled cut, which on a diode laser means a material test: enough power to sever the veneer and its glue line, not enough to dig visibly into the walnut (scorching the walnut does not matter, it is already dark).
- **B. Two separate sheets.** Cut the light sheet right through (3 mm basswood), then glue it onto a walnut sheet. Simpler settings, but every light island becomes a loose part you have to place by hand, so the design must be kept to a few dozen islands or bridged.

The prototype reports the island count for each design so you can decide between A and B.

### Material and settings starting points (xTool S1)

Sources disagree, so treat these as a first test grid, not a recipe:

- 3 mm basswood through-cut: xTool lists 15 mm/s at 100 % for the 40 W module (7 mm/s for 20 W); a third-party guide claims 25–35 mm/s ([xtool.eu material settings](https://www.xtool.eu/pages/material-settings), [Eolas guide](https://eolasprints.com/blogs/laser-cutting-engraving/xtool-laser-settings-guide-power-speed-materials)). xTool also recommends a 3 mm focus drop for cuts ([support article](https://support.xtool.com/article/1190)).
- Score lines: XCS has a dedicated *Score* mode; xTool warns it will cut through if power is too high or speed too low, and that it traverses outer-then-inner, unlike Cut ([How to use Score](https://support.xtool.com/article/1883)). Start around 20–30 % power at 100+ mm/s and go up until the line is a clean brown, then wipe with a damp cloth as the video shows.
- Run the community **S1 speed/power test grid** on your actual basswood and walnut before the first portrait ([test grid project](https://projects.xtool.com/project/32152-test-grid-xtool-s1-speed-and-power-chart)).
- Walnut-veneered plywood / MDF is sold for exactly this; sellers note the cut edge chars dark, which is invisible on walnut and a feature on the light layer's silhouette ([MakerStock](https://makerstock.com/products/walnut-veneer-plywood), [LaserLokaal](https://laserlokaal.nl/en/products/fined-walnut-single-sided)).

### Physical limits that drive the simplification

| Limit | Value used | Why |
|---|---|---|
| Kerf (diode, 3 mm ply) | 0.25–0.35 mm | measured values from Fab Academy and Sculpteo ([1](https://fabacademy.org/2023/labs/sorbonne/students/clara-devanz/group_assignments/week03_group_assignment/), [2](https://sculpteo.com/en/lasercutting/laser-cutting-materials/plywood-material/)) |
| Thinnest light sliver that survives | 0.8 mm (detailed) to 2 mm (silhouette) | lines under ~0.5 mm burn away, under 1 mm are fragile ([Fab Academy](https://fabacademy.org/2020/labs/twarda/students/piotr-bejenka/week03.html), [Binghamton](https://www.binghamton.edu/libraries/about/locations/makerlab/services/laser-cutting/)) |
| Thinnest dark feature worth *cutting* | 1.2–3 mm | anything thinner is weeded with difficulty and reads the same as a score line, so it becomes a score |
| Smallest island (either tone) | 3–25 mm² | below this a light island falls out when weeding, a dark island is a hole smaller than the kerf halo |
| Head size | ≥ 1/3 of panel height | the reference is a bust with the head ~100 mm tall on a ~300 mm panel; at 25–30 mm the eyes and mouth fall under the limits above |

---

## 2. How simple can it go? (results on the test photo)

The prototype has four presets. Same photo, same 239 × 300 mm panel, mom's bust crop:

| Level | Look | Cut paths | Score paths | Light islands | Verdict |
|---|---|---|---|---|---|
| 1 detailed | eyes, nose, smile, hair strands, fabric folds | 74 | 35 | 50 | closest to the reference; needs method A (pre-laminated) |
| 2 medium | same face, body flattened | 53 | 35 | 32 | **best trade-off**: still clearly her, 30 % fewer paths |
| 3 simple | no score lines, bolder shapes | 37 | 0 | 19 | still recognisable, cut-only, fine for method B |
| 4 silhouette | shapes only | 32 | 0 | 10 | reads as "a woman with long hair", not as *her* |

The two things that mattered most:

1. **Crop to a bust.** The three-person full-body version at the same panel size is recognisable as a family photo but no face survives the minimum feature size. The style is a portrait style; for a group, make one panel per person (or a much larger panel).
2. **Detail the face, flatten the body.** Levels 1–2 keep full detail only inside a face-sized ellipse and run the next-simpler preset everywhere else, with shirt prints and fabric texture filled in. That single change removed roughly half the paths with no visible loss in likeness.

Where the automatic result still falls short of the hand-made reference:

- The reference is a **drawn** caricature: solid black hair shape, clean symmetrical sunglasses, two or three deliberate shadow shapes per cheek. The algorithm gives a *stencil*: correct, recognisable, but busier. Dark skin tones make this harder because the local-contrast step has to work from shading rather than from a light/dark split.
- Group photos: the bust crop isolates one person with a head-plus-shoulders mask, so a neighbour's arm can leak in. That needs person instance segmentation (or an AI illustration step) rather than more morphology.

**Conclusion for the generator:** the manufacturability half (sections 4–6 of the pipeline below) is solved and deterministic. The *illustration* half can be (a) this XDoG stencil for a "wood stencil" product tier, or (b) an image-to-image model prompted for "flat two-tone black and white vector portrait, bold outlines, no gradients" whose output is then pushed through the same manufacturability filter. Option (b) is what gets you to the Snip Art look; option (a) is what you can ship today with no GPU.

---

## 3. The prototype (`photo2laser.py`)

```
pip install -r requirements.txt
python3 photo2laser.py photo.jpg --out out --bust 0 --height-mm 300      # bust of leftmost face, all 4 levels
python3 photo2laser.py photo.jpg --out out --level 2                     # whole subject, medium
```

Pipeline (sizes are in millimetres so presets stay valid at any panel size):

1. **Subject isolation** with rembg (isnet-general-use) → alpha mask. Background is always dark walnut.
2. **Bust crop** (optional) from YuNet face detection (OpenCV DNN, model auto-downloaded on first run); head ≈ 1/3 of the window height.
3. **Tone normalisation**: mean-shift to flatten prints and fabric texture, CLAHE on lightness, bilateral denoise, percentile stretch inside the subject. This is what lets dark skin render as light wood with dark shadow lines instead of a solid block.
4. **XDoG** (Winnemöller 2012, [paper](https://users.cs.northwestern.edu/~sco590/winnemoeller-cag2012.pdf)) ink stylisation. σ sets line weight, ε how much turns dark, p the edge emphasis. One operator gives both the fills and the line detail.
5. **Face-aware blend**: this level inside face ellipses, next-simpler level outside; dark blobs touching the top of the head are closed into solid hair.
6. **Manufacturability filter**: open the light tone at `min_light_mm` (slivers vanish), open the dark tone at `min_cut_mm` to split **CUT** (thick) from **SCORE** (thin), drop islands under `min_island_mm2`, smooth.
7. **potrace** → layered SVG at true physical size: red = window + art cut (light layer only), blue = score, black = outer cut. Import straight into XCS or LightBurn and assign a process per colour.
8. **Preview** render on procedural maple/walnut so you can judge it before burning anything.

Outputs per level: `design_*.svg`, `preview_*.png`, `mask_*_cut.png`, `mask_*_score.png`, plus a one-line stats dict (paths and island count) on stdout.

### STL export (3D-printable relief)

```
python3 photo2laser.py photo.jpg --out out --bust 0 --level 2 --height-mm 200 --frame-mm 8 --stl
```

`--stl` writes the same design as a two-tone relief:

| z range | body | meaning |
|---|---|---|
| 0 – 3.0 mm | `*_base.stl` | the dark "walnut" plate, whole panel |
| 3.0 – 4.5 mm | `*_top.stl` | the light layer: panel minus the cut regions inside the window |
| 3.9 mm top | grooves in the top layer | score lines, 0.6 mm deep |

`relief_*.stl` is both bodies in one file. Print it in one colour and add a
**filament change at z = 3.0 mm** (dark below, light above) and you get the
two-tone look from a single-extruder printer; with a multi-material printer
load `_base` and `_top` as two objects. Heights are arguments of `write_stl`
(`base_mm`, `light_mm`, `groove_mm`). At 200 mm tall the panels are 150–160 mm
wide and fit a 220 mm bed; use `--height-mm 300` for the laser-size version.

Meshes are built by extruding the traced polygons (shapely + trimesh). Each
body is checked for watertightness; the `triangle` triangulator gives the
cleanest result on shapes with many holes but can crash on some inputs, so it
runs in a child process with earcut as the fallback. On the test photo every
design slices cleanly; two of them report one large body with a non-manifold
edge where a hole touches the outline, plus a couple of 3 mm² islands with open
edges, which every common slicer repairs on import.

Presets live in `LEVELS` at the top of the script; every number is in mm or mm².

---

## 4. Next steps toward a generator

1. Replace the XDoG front end with an image-to-image "flat vector portrait" model (ControlNet lineart / FLUX Kontext style prompt) and keep steps 6–8 unchanged.
2. Add person instance segmentation so group photos produce clean per-person busts automatically.
3. Add a bridge/tab generator for method B (connect light islands to the body with 1.5 mm tabs) so two-sheet builds need no hand placement.
4. Name plate: the reference engraves a name in script in a light tab in the corner; a `--name` flag with a script font is a 20-line addition.
5. Run the material test grid on real basswood + walnut and record the S1 numbers here.
6. STL: merge the top bodies into one shell (boolean union) and add an optional hanging slot or magnet pocket on the back.
