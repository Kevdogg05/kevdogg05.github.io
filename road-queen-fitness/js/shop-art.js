// Product illustrations, two views each (front + alternate angle), drawn as
// inline SVG so the store looks finished before product photos exist.
// Gradients and the glow filter are defined once in the sprite in index.html.

const crown = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-14 8-17-10l9 6 8-14 8 14 9-6-3 18z" fill="url(#pg-gold)"/>
  <rect x="-14" y="10" width="28" height="4" rx="2" fill="url(#pg-gold)"/>
  <circle cx="0" cy="2" r="2.6" fill="#ff0033"/></g>`;
const label = (x, y, text, size = 12, fill = '#fff', extra = '') =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="${size}" letter-spacing="1.2" fill="${fill}" ${extra}>${text}</text>`;
const neon = 'stroke="#3d6bff" stroke-width="1.6" filter="url(#pg-glow)"';

const TEE = 'M60 44 82 32q18 14 36 0l22 12 30 30-18 18-12-10v80H60V82L48 92 30 74z';
const LEGS = 'M66 46h68l3 36-10 132h-21l-5-120h-2l-5 120H73L63 82z';
const TRAINER = 'M62 42q38-12 76 0-14 80 2 160-40 12-80 0 16-80 2-160z';

const feathers = (cx, cy, s = 1) => {
  let out = '';
  for (let a = -72, i = 0; a <= 72; a += 12, i++) {
    const fill = i % 2 ? 'url(#pg-blue)' : 'url(#pg-red)';
    out += `<g transform="translate(${cx} ${cy}) rotate(${a}) scale(${s})">
      <path d="M0 0C-12-30-10-74 0-108 10-74 12-30 0 0z" fill="${fill}" opacity=".95"/>
      <path d="M0-4V-104" stroke="#fff" stroke-opacity=".45" stroke-width="1"/></g>`;
  }
  return out;
};
const cuff = (cx, cy, s = 1) => `<g transform="translate(${cx} ${cy}) scale(${s})">${feathers(0, 0, 1)}
  <rect x="-34" y="-4" width="68" height="16" rx="8" fill="url(#pg-ink)" ${neon}/>
  ${[-24, -12, 0, 12, 24].map((x, i) => `<circle cx="${x}" cy="4" r="${i === 2 ? 4.5 : 3}" fill="${i === 2 ? '#ff0033' : 'url(#pg-gold)'}"/>`).join('')}</g>`;

const gem = (x, y, r, fill, rot = 0) =>
  `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 ${-r}L${r * 0.8} 0 0 ${r * 1.3}${-r * 0.8} 0z" fill="${fill}" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>`;

const ART = {
  tee: {
    front: `<path d="${TEE}" fill="url(#pg-ink)" ${neon}/>
      <path d="M82 32q18 22 36 0" fill="none" stroke="#ff0033" stroke-width="2.4"/>
      ${crown(100, 88, 1.1)}${label(100, 124, 'ROAD QUEEN', 15)}
      <rect x="76" y="130" width="48" height="3" fill="#ff0033"/>`,
    back: `<path d="${TEE}" fill="url(#pg-ink)" ${neon}/>
      <path d="M82 32q18 6 36 0" fill="none" stroke="#ff0033" stroke-width="2.4"/>
      <rect x="93" y="40" width="14" height="8" rx="1.5" fill="url(#pg-gold)"/>
      ${label(100, 92, 'WINE.', 22)}${label(100, 118, 'WORK.', 22)}${label(100, 144, 'REIGN.', 22, '#ff0033')}`,
  },
  leggings: {
    front: `<path d="${LEGS}" fill="url(#pg-ink)" ${neon}/>
      <rect x="64" y="44" width="72" height="14" rx="4" fill="#0b1240" stroke="#3d6bff" stroke-width="1.2"/>
      <path d="M67 60 76 212M133 60l-9 152" stroke="#ff0033" stroke-width="4" filter="url(#pg-glow)"/>
      ${crown(100, 51, 0.38)}`,
    back: `<path d="${LEGS}" fill="url(#pg-ink)" ${neon}/>
      <rect x="64" y="44" width="72" height="14" rx="4" fill="#0b1240" stroke="#3d6bff" stroke-width="1.2"/>
      ${label(100, 55, 'ROAD QUEEN', 8.5, '#ffc94d')}
      <path d="M100 58v36M76 78q12 16 24 6 12 10 24-6" fill="none" stroke="#7f9cff" stroke-width="1.6" stroke-opacity=".8"/>
      <path d="M67 60 76 212M133 60l-9 152" stroke="#ff0033" stroke-width="4" filter="url(#pg-glow)"/>`,
  },
  bra: {
    front: `<path d="M80 60 74 26M120 60l6-34" stroke="#3d6bff" stroke-width="7" stroke-linecap="round"/>
      <path d="M56 104q2-38 24-46l20 22 20-22q22 8 24 46v12H56z" fill="url(#pg-ink)" ${neon}/>
      <rect x="56" y="112" width="88" height="20" rx="5" fill="url(#pg-red)"/>
      ${label(100, 127, 'ROAD QUEEN', 10)}${crown(100, 92, 0.55)}`,
    back: `<path d="M72 26l56 76M128 26l-56 76" stroke="url(#pg-blue)" stroke-width="7" stroke-linecap="round"/>
      <path d="M72 26l56 76M128 26l-56 76" stroke="#3d6bff" stroke-width="1.2" filter="url(#pg-glow)"/>
      <path d="M56 96h88v36H56z" fill="url(#pg-ink)" ${neon}/>
      <rect x="56" y="112" width="88" height="20" rx="5" fill="url(#pg-red)"/>
      <circle cx="100" cy="60" r="5" fill="url(#pg-gold)"/>`,
  },
  trainer: {
    front: `<path d="${TRAINER}" fill="url(#pg-ink)" ${neon}/>
      <path d="M76 44q-8 78 2 158M90 40q-4 82 0 166M110 40q4 82 0 166M124 44q8 78-2 158" fill="none" stroke="#ff0033" stroke-width="1.4" stroke-opacity=".7"/>
      <path d="M100 38v170" stroke="url(#pg-gold)" stroke-width="2"/>
      ${Array.from({ length: 12 }, (_, i) => `<circle cx="100" cy="${50 + i * 13}" r="2.2" fill="url(#pg-gold)"/>`).join('')}
      <path d="M62 42q38-12 76 0" fill="none" stroke="#ff0033" stroke-width="3"/>
      <path d="M62 202q38 12 76 0" fill="none" stroke="#ff0033" stroke-width="3"/>`,
    back: `<path d="${TRAINER}" fill="url(#pg-ink)" ${neon}/>
      <path d="M86 40q-4 82 0 166M114 40q4 82 0 166" fill="none" stroke="#3d6bff" stroke-width="1.4"/>
      ${Array.from({ length: 10 }, (_, i) => {
        const y = 52 + i * 15;
        return `<path d="M88 ${y}l24 15M112 ${y}l-24 15" stroke="#ff0033" stroke-width="2"/><circle cx="88" cy="${y}" r="2" fill="url(#pg-gold)"/><circle cx="112" cy="${y}" r="2" fill="url(#pg-gold)"/>`;
      }).join('')}
      ${label(100, 230, 'LACE-UP BACK', 9, '#7f9cff')}`,
  },
  belt: {
    front: `<path d="M30 92q70-16 140 0v58q-70-16-140 0z" fill="url(#pg-ink)" ${neon}/>
      <rect x="146" y="92" width="22" height="54" rx="4" fill="url(#pg-red)" opacity=".9"/>
      <path d="M34 98q66-14 132 0M34 144q66-14 132 0" fill="none" stroke="#ff0033" stroke-width="1.4" stroke-dasharray="3 3"/>
      ${crown(76, 117, 0.7)}${label(116, 128, 'ROAD READY', 15)}`,
    back: `<path d="M30 92q70-16 140 0v58q-70-16-140 0z" fill="url(#pg-red)" stroke="#ff0033" stroke-width="1.6" filter="url(#pg-glow)"/>
      ${Array.from({ length: 13 }, (_, i) => `<path d="M${40 + i * 10} ${100 - (i < 7 ? i : 12 - i) * 0.6}l8 34" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>`).join('')}
      <rect x="32" y="94" width="22" height="52" rx="4" fill="#20123a" stroke="#ffc94d" stroke-width="1"/>
      ${label(108, 168, 'SILICONE GRIP LINING', 10, '#ffd6e0')}`,
  },
  cuffs: {
    front: cuff(100, 168, 1),
    back: `${cuff(66, 172, 0.62)}${cuff(136, 172, 0.62)}${label(100, 222, 'SOLD AS A PAIR', 10, '#ffc94d')}`,
  },
  gems: {
    front: `${gem(100, 98, 16, 'url(#pg-gold)')}
      ${gem(76, 104, 10, '#ff0033', -20)}${gem(124, 104, 10, '#ff0033', 20)}
      ${gem(56, 116, 8, 'url(#pg-blue)', -35)}${gem(144, 116, 8, 'url(#pg-blue)', 35)}
      ${gem(40, 132, 6, 'url(#pg-gold)', -45)}${gem(160, 132, 6, 'url(#pg-gold)', 45)}
      ${[[88, 132], [112, 132], [100, 140], [70, 128], [130, 128]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#fff" opacity=".85"/>`).join('')}
      <path d="M46 92q54-40 108 0" fill="none" stroke="url(#pg-gold)" stroke-width="1.4" stroke-dasharray="2 4"/>`,
    back: `<rect x="44" y="34" width="112" height="172" rx="10" fill="url(#pg-ink)" ${neon}/>
      ${label(100, 58, 'FACE GEMS', 13, '#ffc94d')}
      ${Array.from({ length: 20 }, (_, i) => {
        const x = 62 + (i % 4) * 25;
        const y = 80 + Math.floor(i / 4) * 24;
        const fills = ['url(#pg-gold)', '#ff0033', 'url(#pg-blue)', '#fff'];
        return gem(x, y, 6 + (i % 3), fills[(i + Math.floor(i / 4)) % 4]);
      }).join('')}`,
  },
  cup: {
    front: `<rect x="106" y="8" width="7" height="70" rx="3" transform="rotate(12 110 40)" fill="url(#pg-red)"/>
      <path d="M68 66h64q8 6 6 26l-2 108q0 12-12 12H76q-12 0-12-12l-2-108q-2-20 6-26z" fill="url(#pg-glass)" stroke="#7f9cff" stroke-width="1.6" filter="url(#pg-glow)"/>
      <path d="M66 112h68" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>
      <rect x="66" y="48" width="68" height="18" rx="4" fill="url(#pg-blue)" stroke="#7f9cff" stroke-width="1.4"/>
      <rect x="74" y="80" width="6" height="110" rx="3" fill="#fff" opacity=".25"/>
      ${crown(100, 146, 0.9)}${label(100, 182, 'ROAD MARCH', 12)}`,
    back: `<rect x="106" y="8" width="7" height="70" rx="3" transform="rotate(12 110 40)" fill="url(#pg-red)"/>
      <path d="M68 66h64q8 6 6 26l-2 108q0 12-12 12H76q-12 0-12-12l-2-108q-2-20 6-26z" fill="url(#pg-glass)" stroke="#7f9cff" stroke-width="1.6" filter="url(#pg-glow)"/>
      <rect x="66" y="48" width="68" height="18" rx="4" fill="url(#pg-blue)" stroke="#7f9cff" stroke-width="1.4"/>
      ${label(100, 126, 'DRINK UP', 17)}${label(100, 150, 'WINE ON', 17, '#ff3355')}${label(100, 186, '24 OZ', 10, '#ffc94d')}`,
  },
  bands: {
    front: `<ellipse cx="100" cy="76" rx="62" ry="22" fill="none" stroke="#6f8cff" stroke-width="15"/>
      <ellipse cx="100" cy="122" rx="62" ry="22" fill="none" stroke="#ff0033" stroke-width="15"/>
      <ellipse cx="100" cy="168" rx="62" ry="22" fill="none" stroke="url(#pg-ink)" stroke-width="15"/>
      <ellipse cx="100" cy="168" rx="62" ry="22" fill="none" stroke="#3d6bff" stroke-width="1.4" filter="url(#pg-glow)"/>
      ${label(100, 80, 'LIGHT', 9)}${label(100, 126, 'MEDIUM', 9)}${label(100, 172, 'HEAVY', 9)}`,
    back: `<path d="M60 70q40-14 80 0l10 130q-50 14-100 0z" fill="url(#pg-ink)" ${neon}/>
      <path d="M62 78q38-12 76 0" fill="none" stroke="url(#pg-gold)" stroke-width="2" stroke-dasharray="4 3"/>
      <path d="M86 70q-10-24 6-30M114 70q10-24-6-30" fill="none" stroke="#ff0033" stroke-width="2.4"/>
      ${crown(100, 128, 1.1)}${label(100, 168, 'CARRY POUCH', 12, '#ffc94d')}`,
  },
};

export function productArt(kind, view, name) {
  const body = ART[kind]?.[view] ?? '';
  return `<svg viewBox="0 0 200 240" role="img" aria-label="${name} — ${view === 'front' ? 'front view' : 'alternate view'}">
    <ellipse cx="100" cy="226" rx="62" ry="7" fill="#000" opacity=".45"/>${body}</svg>`;
}
