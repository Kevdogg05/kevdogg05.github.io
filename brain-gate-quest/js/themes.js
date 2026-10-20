/**
 * Brain Gate Quest — visual themes for the five worlds.
 *
 * A theme supplies the palette used to paint tiles and scenery, the sky,
 * which decorations grow in the level, and special rules:
 *   slippery - icy ground (less grip when starting and stopping)
 *   ceiling  - a rock roof across the top of the level (caves)
 *   pit      - 'chasm' (dark drop) or 'lava' (glowing, bubbling lava)
 * Variants (sunset, night) override parts of a theme for single levels.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;

  const HARD_STONE = { base: '#8f9aa6', light: '#d5dde5', dark: '#56606b', inner: '#a6b0bb', innerLight: '#c3cbd3', innerDark: '#76808b' };

  BGQ.THEMES = {
    meadow: {
      world: 'Sunny Meadow',
      sky: { top: [58, 145, 255], bottom: [176, 226, 255] },
      ground: { top: '#43c443', topLight: '#8ef06a', topDark: '#2f9a3a', tuft: '#6edc58', dirt: '#c87b3c', dirtDark: '#a35d26', dirtLight: '#dc9456' },
      brick: { base: '#d2642c', light: '#f29a62', mortar: '#6b2a12' },
      hard: HARD_STONE,
      mountains: { light: '#7a9fd6', dark: '#6488c2', cap: '#eef6ff' },
      hills: { outline: '#2f8f3a', fill: '#5ccf5c', light: '#79dc6c' },
      clouds: { light: '#ffffff', shade: '#c9e3ff' },
      decor: 'bush',
      decorColors: { dark: '#1d7a2c', mid: '#3fbf4a', light: '#8ef06a' },
      pit: 'chasm',
      variants: {
        sunset: {
          sky: { top: [92, 72, 170], bottom: [255, 170, 110] },
          mountains: { light: '#9a7ab8', dark: '#7f62a3', cap: '#ffd8c8' },
          hills: { outline: '#2f6f3a', fill: '#4fae55', light: '#6cc068' },
          clouds: { light: '#ffd6c0', shade: '#f0a090' }
        }
      }
    },

    desert: {
      world: 'Desert Dunes',
      sky: { top: [70, 150, 240], bottom: [255, 222, 160] },
      ground: { top: '#f2d27a', topLight: '#fff0b0', topDark: '#d4a94a', tuft: '#ffe596', dirt: '#e0a85a', dirtDark: '#c08840', dirtLight: '#f0c070' },
      brick: { base: '#d99a4e', light: '#f5c27e', mortar: '#8a5420' },
      hard: { base: '#cfa86a', light: '#f3d9a4', dark: '#8f6a34', inner: '#dbb87e', innerLight: '#ecd09c', innerDark: '#a8824a' },
      mountains: { light: '#e3a868', dark: '#c98a50', cap: '#f5d0a0' },
      hills: { outline: '#c48a3c', fill: '#e8b060', light: '#f5cc80' },
      clouds: { light: '#ffffff', shade: '#ffe3c0' },
      decor: 'cactus',
      pit: 'chasm',
      variants: {
        sunset: {
          sky: { top: [70, 40, 120], bottom: [255, 140, 80] },
          mountains: { light: '#b0607a', dark: '#924a66', cap: '#ffc0a0' },
          hills: { outline: '#a8603a', fill: '#d08a50', light: '#e8a868' },
          clouds: { light: '#ffc8b0', shade: '#e8907a' }
        }
      }
    },

    snow: {
      world: 'Frosty Peaks',
      sky: { top: [110, 160, 225], bottom: [225, 238, 255] },
      ground: { top: '#ffffff', topLight: '#ffffff', topDark: '#bcd6f0', tuft: '#e6f2ff', dirt: '#8fb3d9', dirtDark: '#6f93bd', dirtLight: '#b5d3f0' },
      brick: { base: '#6fa8dc', light: '#b8dcff', mortar: '#2f5f8f' },
      hard: { base: '#a9c3dc', light: '#eef6ff', dark: '#6a88a8', inner: '#bcd2e8', innerLight: '#d8e8f6', innerDark: '#86a2be' },
      mountains: { light: '#c4d6ee', dark: '#a5bddf', cap: '#ffffff' },
      hills: { outline: '#9fb8d8', fill: '#e8f2ff', light: '#ffffff' },
      clouds: { light: '#ffffff', shade: '#d6e6f8' },
      decor: 'pine',
      pit: 'chasm',
      slippery: true,
      variants: {
        night: {
          sky: { top: [8, 12, 40], bottom: [44, 66, 130], stars: true, moon: true },
          mountains: { light: '#3a4f8a', dark: '#2c3d70', cap: '#c8d8ff' },
          hills: { outline: '#5a74a8', fill: '#8fa8d8', light: '#b0c4ea' },
          clouds: { light: '#56619a', shade: '#414b80' }
        }
      }
    },

    cave: {
      world: 'Crystal Caves',
      sky: { top: [14, 10, 30], bottom: [48, 36, 84], stars: true },
      ground: { top: '#7a68a8', topLight: '#a493d6', topDark: '#4a3d6b', tuft: '#8f7fc0', dirt: '#4a3d6b', dirtDark: '#3a2f55', dirtLight: '#5c4d82' },
      brick: { base: '#7a5c9e', light: '#a888cc', mortar: '#2e1f45' },
      hard: { base: '#6e6a8a', light: '#a8a4c8', dark: '#3e3a58', inner: '#7c78a0', innerLight: '#928eb6', innerDark: '#56526e' },
      mountains: { light: '#2e2650', dark: '#251f42', cap: '#3d3466' },
      hills: { outline: '#2a2048', fill: '#3a2f5c', light: '#4a3d70' },
      clouds: null,
      decor: 'crystal',
      pit: 'chasm',
      ceiling: true
    },

    volcano: {
      world: 'Volcano Valley',
      sky: { top: [60, 14, 30], bottom: [240, 110, 60], embers: true },
      ground: { top: '#6a5656', topLight: '#8a7474', topDark: '#3a2e2e', tuft: '#7a6464', dirt: '#4a3434', dirtDark: '#3a2626', dirtLight: '#5e4444' },
      brick: { base: '#8a3a2a', light: '#b85a40', mortar: '#3a1410' },
      hard: { base: '#6a5a5a', light: '#9a8a8a', dark: '#3a2e2e', inner: '#7a6a6a', innerLight: '#8a7a7a', innerDark: '#4a3e3e' },
      mountains: { light: '#5a2a3a', dark: '#4a1f2e', cap: '#ff7a3a' },
      hills: { outline: '#2a1418', fill: '#3a2228', light: '#4f2c34' },
      clouds: { light: '#6a4a50', shade: '#4a3038' },
      decor: 'rock',
      pit: 'lava'
    }
  };

  /** Returns a theme with an optional variant (e.g. 'sunset') merged in. */
  BGQ.getTheme = function (id, variant) {
    const base = BGQ.THEMES[id];
    const theme = Object.assign({ id: id }, base);
    if (variant && base.variants && base.variants[variant]) Object.assign(theme, base.variants[variant]);
    theme.key = id + (variant ? ':' + variant : '');
    return theme;
  };
})();
