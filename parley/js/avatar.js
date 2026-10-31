// Illustrated SVG characters with moods, blinking and a talking mouth.
// avatarSvg(spec) → SVG string. Set data-mood on the <svg> to change expression,
// and add the class "talking" while the character speaks.
const SKIN = {
  porcelain: ['#f7dfcf', '#e9c3ac'], light: ['#f0c6a4', '#dcaa86'], tan: ['#d9a272', '#c0875a'],
  olive: ['#c18d5f', '#a6744a'], brown: ['#8f5b3b', '#774a2f'], deep: ['#5c3b29', '#4a2e20'],
};
const HAIR = {
  black: '#1e1a1d', 'dark-brown': '#3a2519', brown: '#6a4326', auburn: '#8c3a1e',
  blonde: '#dcb468', gray: '#a8a8b2', red: '#b8481d',
};
const CLOTH = {
  navy: '#1f2b5c', blue: '#2f6fe0', teal: '#13999b', green: '#2e8b57', maroon: '#7a1f35', purple: '#6a3fb5',
  gray: '#6b7280', black: '#22222b', white: '#eef0f5', mustard: '#d8a42a', coral: '#ef7060',
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('');
}

// Hair drawn behind the head (long styles) and in front (fringe, top).
function hairBack(style, c) {
  switch (style) {
    case 'long': return `<path d="M52 92c-4 40 2 78 8 102h80c6-24 12-62 8-102-4-34-24-50-48-50s-44 16-48 50z" fill="${c}"/>`;
    case 'wavy': return `<path d="M54 90c-8 22 4 34-4 52 8 14-2 30 10 46h80c12-16 2-32 10-46-8-18 4-30-4-52-6-30-24-46-46-46s-40 16-46 46z" fill="${c}"/>`;
    case 'bob': return `<path d="M54 92c-4 24-2 42 6 58h80c8-16 10-34 6-58-4-32-22-48-46-48s-42 16-46 48z" fill="${c}"/>`;
    case 'ponytail': return `<path d="M128 70c26 6 32 40 22 70-4 12-14 16-20 10 12-24 10-50-6-66z" fill="${c}"/>`;
    case 'locs': return `<g fill="${c}"><path d="M54 84c-6 30-4 70 4 104h84c8-34 10-74 4-104-6-28-24-42-46-42s-40 14-46 42z"/></g><g stroke="${shade(c, 0.08)}" stroke-width="3" opacity=".7"><path d="M64 120v62M76 126v64M124 126v64M136 120v62"/></g>`;
    case 'afro': return `<circle cx="100" cy="78" r="58" fill="${c}"/>`;
    case 'curly': return `<g fill="${c}">${[[62, 70], [72, 52], [90, 42], [110, 42], [128, 52], [138, 70], [58, 92], [142, 92]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="17"/>`).join('')}</g>`;
    default: return '';
  }
}
function hairFront(style, c) {
  const hl = shade(c, 0.1);
  switch (style) {
    case 'short': return `<path d="M58 90c-2-30 16-50 42-50s46 18 42 50c-6-14-14-22-26-24-12 8-34 10-52 6-4 6-6 12-6 18z" fill="${c}"/>`;
    case 'side-part': return `<path d="M58 92c-4-32 16-52 44-52 26 0 44 20 40 50-4-12-12-20-22-24-20 2-40-2-52-6-6 8-10 20-10 32z" fill="${c}"/><path d="M84 44c4 6 4 14 0 20" stroke="${hl}" stroke-width="2" fill="none"/>`;
    case 'curly': return `<g fill="${c}">${[[66, 76], [80, 60], [98, 54], [116, 58], [132, 72], [74, 64], [124, 62]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13"/>`).join('')}</g>`;
    case 'wavy': return `<path d="M56 96c-2-34 18-54 44-54s46 20 44 54c-6-16-12-24-20-28-6 8-18 12-30 10-10 6-24 4-30 0-4 6-6 12-8 18z" fill="${c}"/>`;
    case 'long': return `<path d="M56 98c-2-36 18-56 44-56s46 20 44 56c-8-18-22-32-44-36-20 4-36 18-44 36z" fill="${c}"/>`;
    case 'bob': return `<path d="M56 96c-2-34 18-54 44-54s46 20 44 54c-10-6-20-20-26-32-14 10-40 12-62 32z" fill="${c}"/>`;
    case 'bun': return `<circle cx="100" cy="34" r="17" fill="${c}"/><path d="M58 92c-2-32 16-50 42-50s44 18 42 50c-8-16-20-26-42-28-22 2-34 12-42 28z" fill="${c}"/>`;
    case 'ponytail': return `<path d="M58 92c-2-32 16-50 42-50s44 18 42 50c-8-16-20-26-42-28-22 2-34 12-42 28z" fill="${c}"/>`;
    case 'afro': return `<path d="M54 90c0-20 8-34 18-40 20 6 42 6 56 0 10 6 18 20 18 40-10-14-26-20-46-20s-36 6-46 20z" fill="${c}"/>`;
    case 'buzz': return `<path d="M58 88c0-28 18-44 42-44s42 16 42 44c-10-12-24-18-42-18s-32 6-42 18z" fill="${c}" opacity=".85"/>`;
    case 'locs': return `<path d="M56 94c-2-32 18-52 44-52s46 20 44 52c-10-14-20-22-30-24l-14 6-14-6c-10 2-20 10-30 24z" fill="${c}"/>`;
    case 'bald': return `<path d="M70 58c10-8 22-12 30-12" stroke="#fff" stroke-opacity=".25" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    default: return '';
  }
}

function outfit(style, c) {
  const d = shade(c, -0.12), l = shade(c, 0.12);
  const base = `<path d="M30 240c0-40 22-62 52-68l18 8 18-8c30 6 52 28 52 68z" fill="${c}"/>`;
  switch (style) {
    case 'blazer': return base + `<path d="M84 172l16 40 16-40-16 6z" fill="#f4f5f8"/><path d="M82 172l-10 26 22 20 6-6zM118 172l10 26-22 20-6-6z" fill="${d}"/><path d="M100 212v28" stroke="${d}" stroke-width="2"/>`;
    case 'shirt': return base + `<path d="M84 170l16 22 16-22-6-4-10 10-10-10z" fill="${l}"/><path d="M100 192v48" stroke="${d}" stroke-width="2"/><circle cx="100" cy="204" r="2" fill="${d}"/><circle cx="100" cy="222" r="2" fill="${d}"/>`;
    case 'tee': return base + `<path d="M84 172c4 10 28 10 32 0" fill="none" stroke="${d}" stroke-width="4"/>`;
    case 'sweater': return base + `<path d="M82 172c6 14 30 14 36 0" fill="none" stroke="${l}" stroke-width="7"/><path d="M50 214v26M150 214v26" stroke="${d}" stroke-width="3"/>`;
    case 'hoodie': return base + `<path d="M70 178c8-12 52-12 60 0-10 14-50 14-60 0z" fill="${d}"/><path d="M92 186v24M108 186v24" stroke="#f4f5f8" stroke-width="3" stroke-linecap="round"/>`;
    case 'dress': return `<path d="M34 240c0-38 20-60 50-66 8 10 24 10 32 0 30 6 50 28 50 66z" fill="${c}"/><path d="M84 174c6 12 26 12 32 0" fill="none" stroke="${d}" stroke-width="3"/>`;
    case 'polo': return base + `<path d="M84 170l16 14 16-14 4 10-20 10-20-10z" fill="${l}"/><path d="M100 186v20" stroke="${d}" stroke-width="2"/><circle cx="100" cy="194" r="1.8" fill="${d}"/>`;
    default: return base;
  }
}

function beard(style, c) {
  switch (style) {
    case 'stubble': return `<path d="M66 116c4 26 18 40 34 40s30-14 34-40c-6 10-16 16-34 16s-28-6-34-16z" fill="${c}" opacity=".16"/>`;
    case 'full': return `<path d="M62 108c0 34 16 54 38 54s38-20 38-54c-6 14-14 18-22 18-6-6-26-6-32 0-8 0-16-4-22-18z" fill="${c}"/>`;
    case 'mustache': return `<path d="M86 127c6-4 10-4 14-1 4-3 8-3 14 1-4 4-10 4-14 2-4 2-10 2-14-2z" fill="${c}"/>`;
    default: return '';
  }
}

// Mouths and brows per mood. data-m lists the moods the part belongs to.
const MOUTHS = `
  <path data-m="neutral think" d="M90 131c6 2 14 2 20 0" fill="none" stroke="#7a3b30" stroke-width="3" stroke-linecap="round"/>
  <path data-m="smile" d="M86 128c6 9 22 9 28 0" fill="none" stroke="#7a3b30" stroke-width="3.2" stroke-linecap="round"/>
  <path data-m="laugh" d="M85 126c2 14 28 14 30 0z" fill="#7a2f2a"/><path data-m="laugh" d="M89 127h22c-1 3-3 4-11 4s-10-1-11-4z" fill="#fff"/>
  <path data-m="worried" d="M89 133c4-4 8-4 11-1 3-3 8-3 11 1" fill="none" stroke="#7a3b30" stroke-width="3" stroke-linecap="round"/>
  <path data-m="annoyed" d="M89 134c7-3 15-3 22 0" fill="none" stroke="#7a3b30" stroke-width="3" stroke-linecap="round"/>
  <ellipse data-m="surprised" cx="100" cy="132" rx="6" ry="7.5" fill="#7a2f2a"/>
  <ellipse class="mouth-talk" cx="100" cy="131" rx="9" ry="6" fill="#7a2f2a"/>`;
const BROWS = (c) => `
  <g data-m="neutral smile laugh" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M70 86c5-4 12-5 18-3"/><path d="M112 83c6-2 13-1 18 3"/></g>
  <g data-m="think" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M70 84c5-5 12-6 18-3"/><path d="M112 86c6-1 13 0 18 2"/></g>
  <g data-m="worried" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M70 88c6-1 12-4 17-8"/><path d="M113 80c5 4 11 7 17 8"/></g>
  <g data-m="annoyed" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M70 82c6 1 12 3 18 6"/><path d="M112 88c6-3 12-5 18-6"/></g>
  <g data-m="surprised" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M70 80c5-6 12-7 18-4"/><path d="M112 76c6-3 13-2 18 4"/></g>`;

export function avatarSvg(spec = {}, { mood = 'neutral', cls = '', title = '' } = {}) {
  const [skin, skinD] = SKIN[spec.skin] || SKIN.light;
  const hc = HAIR[spec.hairColor] || HAIR.brown;
  const oc = CLOTH[spec.outfitColor] || CLOTH.blue;
  const browC = spec.hair === 'bald' || spec.hair === 'buzz' ? shade(hc, -0.05) : shade(hc, -0.08);
  const blinkDelay = (Math.random() * 3).toFixed(2);
  return `<svg class="av ${cls}" data-mood="${mood}" viewBox="0 0 200 240" role="img" aria-label="${title || 'Character'}">
    <g class="av-body">${outfit(spec.outfit, oc)}</g>
    <g class="av-head">
      ${hairBack(spec.hair, hc)}
      <path d="M86 150h28v28c-8 6-20 6-28 0z" fill="${skinD}"/>
      <ellipse cx="57" cy="104" rx="8" ry="11" fill="${skinD}"/><ellipse cx="143" cy="104" rx="8" ry="11" fill="${skinD}"/>
      <path d="M58 96c0-30 18-50 42-50s42 20 42 50c0 34-18 62-42 62s-42-28-42-62z" fill="${skin}"/>
      <ellipse data-m="smile laugh" cx="74" cy="118" rx="8" ry="5" fill="#ff7a7a" opacity=".22"/>
      <ellipse data-m="smile laugh" cx="126" cy="118" rx="8" ry="5" fill="#ff7a7a" opacity=".22"/>
      <g class="av-eyes" style="animation-delay:${blinkDelay}s">
        <ellipse cx="80" cy="99" rx="4.6" ry="5.4" fill="#2a1f22"/><ellipse cx="120" cy="99" rx="4.6" ry="5.4" fill="#2a1f22"/>
        <circle cx="81.5" cy="97.5" r="1.4" fill="#fff"/><circle cx="121.5" cy="97.5" r="1.4" fill="#fff"/>
      </g>
      <path d="M100 104c-2 7-4 12-4 15 2 2 6 2 8 0" fill="none" stroke="${skinD}" stroke-width="2.6" stroke-linecap="round"/>
      ${BROWS(browC)}
      ${beard(spec.beard, hc)}
      <g class="av-mouth">${MOUTHS}</g>
      ${hairFront(spec.hair, hc)}
      ${spec.glasses ? `<g fill="none" stroke="#1d1d26" stroke-width="3"><rect x="64" y="88" width="30" height="22" rx="8"/><rect x="106" y="88" width="30" height="22" rx="8"/><path d="M94 97c4-3 8-3 12 0M64 96l-7-2M136 96l7-2"/></g>` : ''}
    </g>
  </svg>`;
}

export function setMood(svg, mood = 'neutral') {
  if (svg) svg.dataset.mood = mood || 'neutral';
}

/** Tiny round face for list items and chat bubbles. */
export function avatarBadge(spec, size = 44) {
  return `<span class="av-badge" style="width:${size}px;height:${size}px">${avatarSvg(spec, { mood: 'smile' })}</span>`;
}
