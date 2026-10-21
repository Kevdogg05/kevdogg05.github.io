// Machine profiles. Figures come from Consew's published spec sheets
// (315R-2 brochure; 2206RB-14-7DD dealer specs). Threading paths are the
// standard routing for each machine class — the training tab asks the
// operator to confirm against the figure in their own manual.

export const MACHINES = {
  '315R': {
    id: '315R',
    name: 'Consew 315R',
    role: 'Light–medium precision machine',
    tagline: 'High-speed single-needle lockstitch · drop feed synchronized with needle feed',
    feedLabel: 'Drop feed + needle feed (no walking foot)',
    specs: [
      ['Stitch', '301 lockstitch, 1 needle'],
      ['Feed', 'Drop feed synchronized with needle feed'],
      ['Needle system', 'DBx1 (16x257) · #11–#18 (Nm 75–110)'],
      ['Max stitch length', '4 mm (6.4 SPI)'],
      ['Presser foot lift', '5.5 mm by hand · 14 mm by knee'],
      ['Max speed', '5,000 SPM light goods · 4,000 SPM medium–heavy'],
      ['Hook / bobbin', 'C-27 horizontal-axis rotary hook · L-style bobbin'],
      ['Arm clearance', '10″ (254 mm)'],
      ['Lubrication', 'Fully automatic (recirculating pump)'],
    ],
    limits: {
      needleSystem: 'DBx1 (16x257)',
      leatherSystem: 'DBx1 LR / S leather points',
      nmMin: 75,
      nmMax: 110,
      texMin: 18,
      texMax: 45,
      maxStitchMm: 4,
      minSpi: 6.4,
      footLiftMm: 5.5,
      kneeLiftMm: 14,
      practicalStackMm: 3.5,
      walking: false,
      maxSpm: 5000,
    },
    bestFor: [
      'Linings, pockets and organizer panels in pack cloth, cotton and 500D nylon',
      'Fine topstitching (8–11 SPI) and edge-stitching with a compensating foot',
      'Zippers in light goods, apparel seams, French seams',
      'Slippery two-layer seams (needle feed keeps the layers together at the needle)',
    ],
    avoid: [
      'Thread heavier than Tex 45 (V-46) — the #18 needle is the top of its range',
      'Stitches longer than 4 mm (it cannot go below 6.4 SPI)',
      'Stacks over ~3.5 mm compressed, welt cord, webbing box-X tacks',
      'Multi-layer vinyl or leather without a Teflon/roller foot (the top layer creeps)',
    ],
    autoNote: 'The 315R-7DD variant adds a direct-drive motor with auto trim, auto backtack and auto foot lift; the base 315R-2 uses the reverse lever and knee lifter.',
    threading: [
      {
        title: 'Make the machine safe',
        text: 'Switch the motor OFF. Turn the handwheel toward you until the take-up lever is at its highest point. Raise the presser foot with the hand lifter — that opens the tension discs so the thread can seat between them.',
        at: 'handwheel',
      },
      {
        title: 'Cone → stand eyelet',
        text: 'Set the cone on the stand pin and lead the thread straight up through the stand eyelet directly above it. The vertical pull keeps the thread from twisting off the cone.',
        at: 'stand',
      },
      {
        title: 'Arm thread guide',
        text: 'Bring the thread forward to the guide on top of the arm. On a 3-hole guide, weave in–out–in for slippery bonded synthetics; run straight through for cotton and poly-core.',
        at: 'armGuide',
      },
      {
        title: 'Head guide & pre-tension',
        text: 'Through the thread guide on top of the head, then around the small pre-tension (tension No. 1). It steadies the thread before the main discs.',
        at: 'preTension',
      },
      {
        title: 'Main tension discs',
        text: 'Down between the main tension discs. Floss the thread in with both hands so it sits fully between the plates, then lead it toward the check spring.',
        at: 'tension',
      },
      {
        title: 'Check (take-up) spring',
        text: 'Catch the thread under the hook of the check spring. Tug the thread: the spring should flick and return. If it does not move, the thread missed the discs.',
        at: 'checkSpring',
      },
      {
        title: 'Up to the take-up lever',
        text: 'Up through the thread guide and through the take-up lever eye from right to left.',
        at: 'takeUp',
      },
      {
        title: 'Face-plate guide',
        text: 'Back down through the thread guide on the face plate.',
        at: 'faceGuide',
      },
      {
        title: 'Needle-bar guide',
        text: 'Into the thread guide at the bottom of the needle bar.',
        at: 'barGuide',
      },
      {
        title: 'Thread the needle — left to right',
        text: 'The DBx1 needle sits with its long groove facing LEFT and its scarf facing RIGHT, toward the hook. Thread the eye from left to right (always from the long-groove side) and pull a 3″ tail.',
        at: 'needle',
      },
      {
        title: 'Pick up the bobbin thread',
        text: 'Hold the needle tail, turn the handwheel one full turn toward you, then pull the needle tail to draw up the bobbin loop. Lay both tails back under the foot.',
        at: 'needle',
      },
    ],
    bobbin: {
      type: 'L-style bobbin, C-27 horizontal-axis hook (loads from the left, under the bed)',
      wind: [
        'Put an empty L bobbin on the winder spindle beside the handwheel.',
        'Lead thread from a second cone through the winder tension disc, wrap 5–6 turns on the bobbin by hand.',
        'Push the winder lever against the bobbin, raise the presser foot and run the machine. The winder trips itself at ~80 % full.',
        'If the wind is cone-shaped, slide the winder tension guide toward the thin side.',
      ],
      load: [
        'Drop the bobbin into the case so the thread unwinds clockwise as you look into the open side.',
        'Pull the thread into the slit and under the tension spring until it exits the notch.',
        'Pull the tail: the bobbin should turn clockwise. If it turns the other way, flip the bobbin.',
        'Open the case latch, push the case onto the hook post until it clicks, close the latch.',
      ],
      tension: 'Drop test: hang the case by its thread and give one light jerk — it should slide 1–2″ and stop. Light goods: a little looser; heavier thread: a little firmer.',
    },
    mechanics: [
      {
        title: 'Needle feed vs. walking foot',
        text: 'The needle travels with the feed dog, so the layers it has pierced cannot shift — excellent on slick pack cloth. But nothing drives the top layer from above: on vinyl and leather the presser foot drags the top ply. Use a PTFE (Teflon) foot, a roller foot or tissue paper on top, and lighten foot pressure.',
      },
      {
        title: 'Stitch length ceiling',
        text: 'Maximum 4 mm (6.4 SPI). Patterns that call for 5–6 SPI (vinyl, veg-tan, heavy decorative topstitching) belong on the 2206RB.',
      },
      {
        title: 'Pivoting with the knee lifter',
        text: 'Stop with the needle down, lift the foot with the knee lifter (up to 14 mm), turn the work, lower and continue. Hands never leave the work.',
      },
      {
        title: 'Speed discipline',
        text: '5,000 SPM is a production number. For bag work, cap the servo at 2,000–2,500 SPM and run full speed only on long straight seams.',
      },
      {
        title: 'Edge-stitching',
        text: 'A ¹⁄₁₆″ compensating (edge-guide) foot rides the fold for perfectly even edge-stitching on pockets and binding.',
      },
      {
        title: 'Oil',
        text: 'Lubrication is automatic. Check the oil level in the pan sight-glass before every session and watch the oil window on the arm while it runs.',
      },
    ],
  },

  '2206RB': {
    id: '2206RB',
    name: 'Consew 2206RB-14-7DD-1',
    role: 'Heavy-duty walking foot',
    tagline: 'Single-needle triple-feed walking foot · 14″ arm · direct drive with auto trim, auto foot lift and auto backtack',
    feedLabel: 'Triple / compound feed: drop feed + needle feed + alternating presser feet',
    specs: [
      ['Stitch', '301 lockstitch, 1 needle'],
      ['Feed', 'Compound feed — feed dog, needle and alternating (walking) feet move together'],
      ['Needle system', '135x17 (cloth) · 135x16 (leather points) · typically #18–#23 (Nm 110–160)'],
      ['Max stitch length', '8 mm (≈3.2 SPI)'],
      ['Clearance under foot', '13 mm (33⁄64″)'],
      ['Max speed', '3,000 SPM'],
      ['Hook / bobbin', 'Large horizontal-axis side-load hook · M-style bobbin'],
      ['Arm clearance', '14″ × 5.9″ (355 × 150 mm)'],
      ['Automation', 'Thread trimmer, electric foot lift, auto backtack, needle positioning, knuckle-switch reverse, auto lubrication'],
    ],
    limits: {
      needleSystem: '135x17',
      leatherSystem: '135x16 (LR / S leather points)',
      nmMin: 110,
      nmMax: 160,
      texMin: 45,
      texMax: 135,
      maxStitchMm: 8,
      minSpi: 3.2,
      footLiftMm: 13,
      kneeLiftMm: 13,
      practicalStackMm: 10,
      walking: true,
      maxSpm: 3000,
    },
    bestFor: [
      'Structural seams in 1000D Cordura, ballistic nylon, canvas and acrylic',
      'Marine vinyl and upholstery leather — every layer is driven, nothing creeps',
      'Welt cord, zipper boxing, binding, webbing box-X bartacks',
      'Heavy thread (Tex 70–135) and long stitches (5–7 SPI)',
    ],
    avoid: [
      'Thread lighter than Tex 45 — the heavy hook and large needles do not form a neat lock with fine thread',
      'Fine linings at 9+ SPI where the 315R gives a crisper result',
      'Stacks over ~10 mm compressed, or Tex 210 (V-207) strap stitching',
    ],
    autoNote: 'The “-7DD” suffix means direct-drive motor with automatic functions. Panel layouts vary by control box — the functions below are the ones to look for.',
    threading: [
      {
        title: 'Power OFF, foot up by hand',
        text: 'Switch the control box OFF — the electric foot lifter and trimmer can fire at power-up. Turn the handwheel toward you until the take-up lever is at its highest point, and raise the presser foot with the hand lifter so the tension discs open.',
        at: 'handwheel',
      },
      {
        title: 'Cone → stand eyelet',
        text: 'Cone on the stand, thread straight up through the eyelet above it. With slick bonded nylon in Tex 90–135, put a thread net over the cone so it does not puddle at the base.',
        at: 'stand',
      },
      {
        title: 'Rear arm guide',
        text: 'Forward to the thread guide on top of the arm.',
        at: 'armGuide',
      },
      {
        title: 'Head guide & pre-tension',
        text: 'Through the guide on top of the head and around the pre-tension disc. Heavy thread needs this first stage to arrive at the main discs under control.',
        at: 'preTension',
      },
      {
        title: 'Thread guide pins',
        text: 'Through the guide pins/holes on the face so the thread enters the main tension squarely.',
        at: 'pins',
      },
      {
        title: 'Main tension discs',
        text: 'Down between the main tension discs and floss the thread in fully. It should exit toward the check spring.',
        at: 'tension',
      },
      {
        title: 'Check spring',
        text: 'Hook the thread under the check spring. With heavy thread the spring needs a slightly longer stroke — if stitches loop on top at the start of seams, that is the first thing to check.',
        at: 'checkSpring',
      },
      {
        title: 'Take-up lever',
        text: 'Up through the thread guide and through the take-up lever eye from right to left.',
        at: 'takeUp',
      },
      {
        title: 'Face guide → needle-bar guide',
        text: 'Down through the face-plate guide and the thread guide at the bottom of the needle bar.',
        at: 'barGuide',
      },
      {
        title: 'Thread the needle — long-groove side first',
        text: 'Install the 135x17 (or 135x16) needle with the long groove facing LEFT and the scarf facing RIGHT, toward the hook point, then thread the eye from left to right. Confirm against your manual’s needle figure: the scarf must face the hook.',
        at: 'needle',
      },
      {
        title: 'Leave a working tail',
        text: 'Pull a 4″ tail and bring up the bobbin thread with one handwheel turn. After an automatic trim the needle tail is shorter; if the first stitch pulls out, enable soft-start on the panel.',
        at: 'needle',
      },
    ],
    bobbin: {
      type: 'M-style bobbin, large horizontal-axis side-load hook (about twice the capacity of an L bobbin)',
      wind: [
        'Put an empty M bobbin on the winder spindle.',
        'Lead thread from a second cone through the winder tension, wrap 5–6 turns by hand.',
        'Engage the winder lever, raise the foot and run the machine at moderate speed; the winder releases at ~80 % full.',
        'Wind evenly — heavy bonded thread piled to one side causes bobbin backlash and loops underneath.',
      ],
      load: [
        'Open the slide plate to reach the side-load hook.',
        'Drop the M bobbin in so the thread unwinds clockwise viewed from the open side.',
        'Draw the thread through the slit and under the tension spring; the bobbin should turn clockwise as you pull.',
        'Open the latch, seat the case on the hook post until it clicks, close the latch and the slide plate.',
      ],
      tension: 'Drop test for Tex 70–90: the case should slide 1″ with a firm flick and hold still otherwise. Tex 135 bobbins run firmer. Set the bobbin first, then balance the top tension to it.',
    },
    mechanics: [
      {
        title: 'How the triple feed works',
        text: 'Feed dog below, needle through the work and the walking (vibrating) foot on top all move the layers together. That is why vinyl, leather, coated nylon and welt sandwiches go through without creeping — so never push or pull the work; just guide it.',
      },
      {
        title: 'Alternating foot lift',
        text: 'The walking and presser feet take turns lifting. Set the lift just higher than the tallest step you will climb (webbing edge, welt, seam crossing). More lift than needed costs smoothness and noise — reduce speed when it is raised.',
      },
      {
        title: 'Presser foot pressure',
        text: 'Light on vinyl and leather (no foot marks), medium on Cordura and canvas, firmer on slick ballistic. Too little and the walking foot lifts the work with it.',
      },
      {
        title: 'Climbing a hump',
        text: 'Approach a seam crossing at slow speed. As the foot reaches the step, hand-wheel 2–3 stitches over it, then resume. A shim (a folded scrap) behind the foot levels it for the climb.',
      },
      {
        title: 'Pedal and automatic functions',
        text: 'Toe down: sew. Pedal at neutral: stop (needle stops in its programmed position). Heel back halfway: presser foot lifts. Heel back fully: thread trim, then foot lift. The knuckle switch on the head reverses while held.',
      },
      {
        title: 'Needle position for pivots',
        text: 'Program needle-DOWN stop. At a corner the needle holds the work while the foot lifts with a half-heel, you rotate, and continue.',
      },
      {
        title: 'Big arm, big panels',
        text: 'The 14″ arm takes a rolled cushion boxing or a duffel body. Support the work on the table so its weight never drags against the feed.',
      },
    ],
    panel: [
      { key: 'startBT', label: 'Start backtack', icon: '⤺', help: 'Forward/back stitch counts sewn automatically at the start of a seam (often shown as A / B).' },
      { key: 'endBT', label: 'End backtack', icon: '⤻', help: 'Stitch counts sewn when you heel back to trim (often C / D).' },
      { key: 'soft', label: 'Soft start', icon: '◔', help: 'First stitches at low speed so the needle thread is caught before the machine speeds up.' },
      { key: 'needle', label: 'Needle stop position', icon: '⇵', help: 'Where the needle parks when you take your foot off the pedal: UP or DOWN.' },
      { key: 'trim', label: 'Thread trimmer', icon: '✂', help: 'Cuts both threads when you heel back fully.' },
      { key: 'lift', label: 'Auto foot lift', icon: '⇡', help: 'Raises the feet after trimming / on half-heel.' },
      { key: 'speed', label: 'Max speed', icon: '⏲', help: 'Speed ceiling (SPM) for the pedal.' },
    ],
  },
};

export const MACHINE_IDS = Object.keys(MACHINES);
