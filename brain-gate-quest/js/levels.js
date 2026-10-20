/**
 * Brain Gate Quest — the 20 levels.
 *
 * Five worlds of four levels each. Difficulty ramps up gradually, and each
 * world introduces something new (flyers, elevators, ice, springs, spiky
 * enemies, caves, lava). Every level has three Brain Gates.
 *
 * Each section is [name, options]; see builder.js for what they do.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;

  const LEVELS = [
    /* ===================== World 1: Sunny Meadow ===================== */
    {
      name: 'First Steps', theme: 'meadow',
      tip: 'Hold JUMP longer to jump higher!',
      sections: [
        ['start'], ['flat', { w: 10, coins: true }], ['blocks', { v: 'classic' }], ['pipes', { h: [2] }],
        ['pit', { w: 2 }], ['gate'],
        ['flat', { w: 8, enemies: 1 }], ['blocks', { v: 'row' }], ['pit', { w: 3 }], ['gate'],
        ['pipes', { h: [2, 3] }], ['coinGarden'], ['gate'],
        ['flat', { w: 6 }], ['finish', { h: 4 }]
      ]
    },
    {
      name: 'Pipe Parade', theme: 'meadow',
      tip: 'Stomp Grumblobs from above!',
      sections: [
        ['start'], ['flat', { w: 6 }], ['pipes', { h: [2, 3, 2] }], ['blocks', { v: 'row' }], ['gate'],
        ['pit', { w: 3 }], ['pipes', { h: [3, 4] }], ['flat', { w: 10, enemies: 2 }], ['gate'],
        ['blocks', { v: 'heart' }], ['stairsPit', { h: 3, gap: 2 }], ['gate'],
        ['pipes', { h: [2, 3] }], ['finish', { h: 6 }]
      ]
    },
    {
      name: 'Brick Bridges', theme: 'meadow',
      tip: 'Cross the bridges — the spikes below are sharp!',
      sections: [
        ['start'], ['blocks', { v: 'classic' }], ['bridge', { w: 3 }], ['gate'],
        ['parade', { n: 2 }], ['pit', { w: 3 }], ['steps', { w: 8 }], ['gate'],
        ['bridge', { w: 4 }], ['spikeHops', { n: 2 }], ['blocks', { v: 'row' }], ['gate'],
        ['flat', { w: 6, coins: true }], ['finish', { h: 6 }]
      ]
    },
    {
      name: 'Sunset Run', theme: 'meadow', variant: 'sunset',
      tip: 'Ride the moving platforms across wide gaps!',
      sections: [
        ['start'], ['moverPit', { w: 8 }], ['pipes', { h: [2, 3] }], ['gate'],
        ['stairsPit', { h: 4, gap: 3 }], ['parade', { n: 3 }], ['gate'],
        ['moverPit', { w: 9 }], ['blocks', { v: 'high' }], ['gate'],
        ['towers', { h: [2, 3, 2] }], ['finish', { h: 8 }]
      ]
    },

    /* ===================== World 2: Desert Dunes ===================== */
    {
      name: 'Sandy Start', theme: 'desert',
      tip: 'Buzzers fly — stomp them from above or duck under!',
      sections: [
        ['start'], ['flyers', { n: 1 }], ['pit', { w: 3 }], ['blocks', { v: 'row' }], ['gate'],
        ['flyers', { n: 2 }], ['pipes', { h: [2, 3] }], ['gate'],
        ['towers', { h: [2, 3, 3] }], ['flyers', { n: 2 }], ['gate'],
        ['flat', { w: 6, coins: true }], ['finish', { h: 6 }]
      ]
    },
    {
      name: 'Cactus Canyon', theme: 'desert',
      tip: 'Hop from island to island!',
      sections: [
        ['start'], ['islands', { n: 3 }], ['gate'],
        ['spikeHops', { n: 3 }], ['steps', { w: 8 }], ['gate'],
        ['parade', { n: 3 }], ['pit', { w: 4 }], ['blocks', { v: 'heart' }], ['gate'],
        ['coinGarden'], ['finish', { h: 6 }]
      ]
    },
    {
      name: 'Pyramid Steps', theme: 'desert',
      tip: 'Elevators go up and down — time your jump!',
      sections: [
        ['start'], ['stairsPit', { h: 3, gap: 2 }], ['stairsPit', { h: 4, gap: 3 }], ['gate'],
        ['towers', { h: [2, 3, 4, 3] }], ['blocks', { v: 'high' }], ['gate'],
        ['elevatorPit', { w: 7 }], ['stairsPit', { h: 5, gap: 3 }], ['gate'],
        ['flyers', { n: 2 }], ['finish', { h: 8 }]
      ]
    },
    {
      name: 'Desert Dusk', theme: 'desert', variant: 'sunset',
      tip: 'Keep your eyes on the sky — Buzzers are about!',
      sections: [
        ['start'], ['flyers', { n: 2 }], ['moverPit', { w: 10 }], ['gate'],
        ['bridge', { w: 5 }], ['parade', { n: 4 }], ['gate'],
        ['elevatorPit', { w: 8 }], ['islands', { n: 3, flyers: true }], ['gate'],
        ['pipes', { h: [3, 4, 3] }], ['finish', { h: 8 }]
      ]
    },

    /* ===================== World 3: Frosty Peaks ===================== */
    {
      name: 'Slippery Slopes', theme: 'snow',
      tip: 'Brrr! The ice is slippery — start slowing down early.',
      sections: [
        ['start'], ['flat', { w: 8, coins: true }], ['pit', { w: 2 }], ['blocks', { v: 'classic' }], ['gate'],
        ['stairsPit', { h: 3, gap: 2 }], ['pipes', { h: [2, 3] }], ['gate'],
        ['parade', { n: 2 }], ['pit', { w: 3 }], ['blocks', { v: 'row' }], ['gate'],
        ['flat', { w: 6 }], ['finish', { h: 6 }]
      ]
    },
    {
      name: 'Snowball Hills', theme: 'snow',
      tip: 'Spikeshells can\'t be stomped — jump right over them!',
      sections: [
        ['start'], ['parade', { n: 2, type: 'spiky' }], ['blocks', { v: 'row' }], ['gate'],
        ['towers', { h: [2, 3, 2] }], ['steps', { w: 8 }], ['gate'],
        ['parade', { n: 3, type: 'mixed' }], ['pit', { w: 3 }], ['blocks', { v: 'heart', type: 'spiky' }], ['gate'],
        ['flat', { w: 6, coins: true }], ['finish', { h: 6 }]
      ]
    },
    {
      name: 'Frozen Falls', theme: 'snow',
      tip: 'Run over springs to bounce over tall walls — hold JUMP to fly higher!',
      sections: [
        ['start'], ['springWall', { h: 6 }], ['moverPit', { w: 8 }], ['gate'],
        ['islands', { n: 3 }], ['springWall', { h: 7 }], ['gate'],
        ['flyers', { n: 3 }], ['bridge', { w: 4 }], ['gate'],
        ['stairsPit', { h: 4, gap: 3 }], ['finish', { h: 8 }]
      ]
    },
    {
      name: 'Northern Lights', theme: 'snow', variant: 'night',
      tip: 'A starry night on the ice — careful footing!',
      sections: [
        ['start'], ['elevatorPit', { w: 7 }], ['parade', { n: 3, type: 'mixed' }], ['gate'],
        ['steps', { w: 10 }], ['spikeHops', { n: 3 }], ['gate'],
        ['moverPit', { w: 10 }], ['springWall', { h: 6 }], ['blocks', { v: 'heart' }], ['gate'],
        ['towers', { h: [2, 3, 4, 3] }], ['finish', { h: 8 }]
      ]
    },

    /* ===================== World 4: Crystal Caves ===================== */
    {
      name: 'Into the Cave', theme: 'cave',
      tip: 'Watch your head — caves have a rocky ceiling!',
      sections: [
        ['start'], ['tunnel', { w: 10 }], ['pit', { w: 3 }], ['gate'],
        ['blocks', { v: 'row' }], ['parade', { n: 3 }], ['gate'],
        ['steps', { w: 8 }], ['tunnel', { w: 12 }], ['gate'],
        ['flat', { w: 6, coins: true }], ['finish', { h: 6 }]
      ]
    },
    {
      name: 'Crystal Corridors', theme: 'cave',
      tip: 'Grab the shiny coins hidden in the tunnels!',
      sections: [
        ['start'], ['tunnel', { w: 8 }], ['pipes', { h: [3, 4] }], ['gate'],
        ['spikeHops', { n: 3 }], ['moverPit', { w: 9 }], ['gate'],
        ['parade', { n: 4, type: 'mixed' }], ['bridge', { w: 5 }], ['gate'],
        ['blocks', { v: 'heart' }], ['finish', { h: 6 }]
      ]
    },
    {
      name: 'Echo Chambers', theme: 'cave',
      tip: 'Springs work underground too — but mind the ceiling!',
      sections: [
        ['start'], ['elevatorPit', { w: 8 }], ['towers', { h: [2, 3, 4, 3] }], ['gate'],
        ['flyers', { n: 3 }], ['steps', { w: 10 }], ['gate'],
        ['springWall', { h: 6 }], ['islands', { n: 4 }], ['gate'],
        ['tunnel', { w: 8 }], ['finish', { h: 6 }]
      ]
    },
    {
      name: 'Glow Worm Grotto', theme: 'cave',
      tip: 'The deepest cave yet — you can do it!',
      sections: [
        ['start'], ['parade', { n: 4, type: 'mixed' }], ['tunnel', { w: 10 }], ['gate'],
        ['moverPit', { w: 10 }], ['spikeHops', { n: 4 }], ['gate'],
        ['elevatorPit', { w: 8 }], ['bridge', { w: 5 }], ['flyers', { n: 2 }], ['gate'],
        ['stairsPit', { h: 5, gap: 3 }], ['finish', { h: 8 }]
      ]
    },

    /* ===================== World 5: Volcano Valley ===================== */
    {
      name: 'Hot Foot', theme: 'volcano',
      tip: 'Don\'t touch the lava!',
      sections: [
        ['start'], ['pit', { w: 2 }], ['pit', { w: 3 }], ['blocks', { v: 'classic' }], ['gate'],
        ['stairsPit', { h: 4, gap: 3 }], ['flyers', { n: 2 }], ['gate'],
        ['moverPit', { w: 8 }], ['parade', { n: 3 }], ['gate'],
        ['blocks', { v: 'heart' }], ['finish', { h: 6 }]
      ]
    },
    {
      name: 'Magma Mountains', theme: 'volcano',
      tip: 'Climb high and keep moving!',
      sections: [
        ['start'], ['towers', { h: [2, 3, 4, 3] }], ['steps', { w: 10 }], ['gate'],
        ['springWall', { h: 7 }], ['elevatorPit', { w: 8 }], ['gate'],
        ['islands', { n: 4, flyers: true }], ['flyers', { n: 3 }], ['gate'],
        ['pipes', { h: [3, 4] }], ['finish', { h: 8 }]
      ]
    },
    {
      name: 'Fire Bridge', theme: 'volcano',
      tip: 'Long lava lakes ahead — ride carefully!',
      sections: [
        ['start'], ['bridge', { w: 5 }], ['moverPit', { w: 10 }], ['gate'],
        ['parade', { n: 4, type: 'mixed' }], ['stairsPit', { h: 5, gap: 3 }], ['gate'],
        ['moverPit', { w: 12, speed: 48 }], ['spikeHops', { n: 4 }], ['blocks', { v: 'heart' }], ['gate'],
        ['flyers', { n: 2 }], ['finish', { h: 8 }]
      ]
    },
    {
      name: 'The Grand Finale', theme: 'volcano',
      tip: 'The final challenge — show Professor Hoot everything you know!',
      sections: [
        ['start'], ['islands', { n: 4 }], ['springWall', { h: 6 }], ['gate'],
        ['elevatorPit', { w: 9 }], ['parade', { n: 5, type: 'mixed' }], ['steps', { w: 10 }], ['gate'],
        ['moverPit', { w: 12, speed: 46 }], ['flyers', { n: 4 }], ['towers', { h: [3, 4, 3] }], ['gate'],
        ['coinGarden'], ['finish', { h: 8 }]
      ]
    }
  ];

  BGQ.Levels = {
    list: LEVELS,
    count: LEVELS.length,
    perWorld: 4,

    /** World number (1-based) for a level index (0-based). */
    worldOf: function (index) {
      return Math.floor(index / this.perWorld) + 1;
    },

    /** Builds the playable level data for a level index (0-based). */
    build: function (index) {
      const def = LEVELS[index];
      const theme = BGQ.getTheme(def.theme, def.variant);
      const L = BGQ.Builder.assemble(def.sections, theme);
      L.index = index;
      L.name = def.name;
      L.tip = def.tip;
      L.theme = theme;
      L.slippery = !!theme.slippery;
      L.lava = theme.pit === 'lava';
      return L;
    }
  };
})();
