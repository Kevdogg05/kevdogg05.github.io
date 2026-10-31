// Illustrated scene backdrops for small talk and video scenarios.
// backdrop('office') → SVG string that fills its container (slice).
const W = 400, H = 700;

function grad(id, stops, vertical = true) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`;
}
const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function skyline(x, y, w, h, color, seed) {
  const r = rand(seed);
  let out = '', cx = x;
  while (cx < x + w) {
    const bw = 18 + r() * 34, bh = h * (0.35 + r() * 0.65);
    out += `<rect x="${cx.toFixed(1)}" y="${(y + h - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${color}"/>`;
    cx += bw + 3;
  }
  return out;
}

const SCENES = {
  office: () => `
    <defs>${grad('o-wall', [[0, '#1c2c70'], [1, '#3654b0']])}${grad('o-sky', [[0, '#8fb8ef'], [1, '#dbe8fb']])}${grad('o-floor', [[0, '#26304f'], [1, '#141a30']])}</defs>
    <rect width="${W}" height="${H}" fill="url(#o-wall)"/>
    <rect x="16" y="70" width="368" height="420" rx="6" fill="url(#o-sky)"/>
    <g opacity=".55">${skyline(16, 250, 368, 240, '#9fb4d8', 7)}</g>
    <g opacity=".8">${skyline(16, 330, 368, 160, '#7f97c4', 3)}</g>
    <g stroke="#1b2550" stroke-width="10"><path d="M138 70v420M262 70v420"/><path d="M16 300h368" stroke-width="6"/></g>
    <rect x="16" y="70" width="368" height="420" rx="6" fill="none" stroke="#1b2550" stroke-width="10"/>
    <rect y="490" width="${W}" height="${H - 490}" fill="url(#o-floor)"/>
    <g transform="translate(30 380)"><rect x="18" y="80" width="44" height="50" rx="6" fill="#d9dbe6"/>
      <g fill="#3f9a5c"><ellipse cx="40" cy="40" rx="14" ry="44" transform="rotate(-20 40 40)"/><ellipse cx="44" cy="44" rx="12" ry="40" transform="rotate(25 44 44)"/><ellipse cx="38" cy="30" rx="10" ry="34"/></g></g>
    <g transform="translate(300 400)"><rect x="0" y="40" width="70" height="90" rx="6" fill="#2f3b66"/><rect x="8" y="50" width="54" height="8" rx="3" fill="#475486"/></g>`,

  cafe: () => `
    <defs>${grad('c-wall', [[0, '#5a3322'], [1, '#a5683f']])}${grad('c-glow', [[0, '#ffd38a', 0.9], [1, '#ffd38a', 0]])}</defs>
    <rect width="${W}" height="${H}" fill="url(#c-wall)"/>
    <rect x="30" y="140" width="150" height="190" rx="8" fill="#23302a" stroke="#6b4a2c" stroke-width="8"/>
    <g stroke="#e9e3d1" stroke-width="3" stroke-linecap="round" opacity=".75"><path d="M52 175h80M52 200h104M52 225h64M52 262h90M52 287h70"/></g>
    ${[0, 1, 2].map((i) => `<g transform="translate(${210 + i * 0} ${150 + i * 70})"><rect x="0" y="40" width="170" height="8" rx="3" fill="#3a2214"/>
      ${[0, 1, 2, 3, 4].map((j) => `<rect x="${10 + j * 32}" y="${16 + (j % 2) * 4}" width="22" height="${24 - (j % 2) * 4}" rx="4" fill="${['#f4efe6', '#7fc4c0', '#e8a35e', '#f4efe6', '#c9715a'][j]}"/>`).join('')}</g>`).join('')}
    ${[90, 200, 310].map((x) => `<path d="M${x} 0v70" stroke="#2a1a10" stroke-width="3"/><path d="M${x - 26} 96a26 26 0 0 1 52 0z" fill="#2a1a10"/><ellipse cx="${x}" cy="150" rx="70" ry="60" fill="url(#c-glow)" opacity=".55"/><circle cx="${x}" cy="98" r="7" fill="#ffe2a6"/>`).join('')}
    <rect y="500" width="${W}" height="200" fill="#3a2316"/><rect y="500" width="${W}" height="14" fill="#5b3a26"/>`,

  party: () => `
    <defs>${grad('p-bg', [[0, '#170c34'], [1, '#41206e']])}<radialGradient id="p-dot"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#p-bg)"/>
    ${(() => { const r = rand(11); let s = ''; for (let i = 0; i < 26; i++) { const c = ['#ff7ab6', '#5ef0ff', '#ffd23f', '#9b87ff'][i % 4]; s += `<circle cx="${(r() * W).toFixed(0)}" cy="${(120 + r() * 380).toFixed(0)}" r="${(14 + r() * 34).toFixed(0)}" fill="${c}" opacity="${(0.08 + r() * 0.18).toFixed(2)}"/>`; } return s; })()}
    ${[60, 150].map((y, k) => { let s = `<path d="M-10 ${y} Q200 ${y + 90} 410 ${y}" fill="none" stroke="#2b1a4a" stroke-width="2"/>`; for (let i = 0; i <= 12; i++) { const t = i / 12, x = -10 + 420 * t, yy = y + 90 * 2 * t * (1 - t); s += `<circle cx="${x.toFixed(0)}" cy="${(yy + 6).toFixed(0)}" r="14" fill="url(#p-dot)" opacity=".5"/><circle cx="${x.toFixed(0)}" cy="${(yy + 6).toFixed(0)}" r="4.5" fill="${['#ffe08a', '#ffb3d9', '#b3f6ff'][(i + k) % 3]}"/>`; } return s; }).join('')}
    <rect y="520" width="${W}" height="180" fill="#130a26"/>`,

  gala: () => `
    <defs>${grad('g-bg', [[0, '#16237a'], [0.6, '#2f4fc4'], [1, '#1a2c84']])}${grad('g-step', [[0, '#5a78df'], [1, '#3552b8']])}<radialGradient id="g-light" cx=".5" cy=".1" r=".6"><stop offset="0" stop-color="#cfe0ff" stop-opacity=".8"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g-bg)"/>
    <rect width="${W}" height="${H}" fill="url(#g-light)"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="${-40 + i * 30}" y="${560 - i * 38}" width="${480 - i * 30}" height="40" fill="url(#g-step)" stroke="#2a43a3" stroke-width="2"/>`).join('')}
    <path d="M20 250 L400 120" stroke="#9db4f5" stroke-width="12" stroke-linecap="round"/>
    ${Array.from({ length: 11 }, (_, i) => { const x = 30 + i * 36, y = 248 - i * 12.6; return `<path d="M${x - 7} ${y + 4}h14l-3 10c6 8 6 20 0 30l3 14h-14l3-14c-6-10-6-22 0-30z" fill="#7f9be8" stroke="#5d79d1" stroke-width="1.5"/><rect x="${x - 3}" y="${y + 58}" width="6" height="${120 + i * 12}" fill="#4865c9"/>`; }).join('')}
    <g transform="translate(200 40)" opacity=".85"><path d="M0 0v30" stroke="#d8e4ff" stroke-width="2"/>${[-40, -20, 0, 20, 40].map((x, i) => `<circle cx="${x}" cy="${44 + Math.abs(x) / 4}" r="${5 - (i % 2)}" fill="#fff6d8"/>`).join('')}<path d="M-46 46 Q0 70 46 46" fill="none" stroke="#d8e4ff" stroke-width="2"/></g>`,

  park: () => `
    <defs>${grad('k-sky', [[0, '#7cc6ff'], [1, '#d9f1ff']])}${grad('k-grass', [[0, '#73c25e'], [1, '#3f8f3c']])}</defs>
    <rect width="${W}" height="${H}" fill="url(#k-sky)"/>
    <g fill="#fff" opacity=".85"><ellipse cx="90" cy="110" rx="50" ry="16"/><ellipse cx="120" cy="100" rx="30" ry="18"/><ellipse cx="300" cy="170" rx="44" ry="13"/></g>
    <g fill="#4f9a5a">${[[30, 360, 60], [110, 340, 70], [200, 370, 56], [290, 345, 72], [380, 365, 60]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
    <g fill="#3d8448">${[[60, 400, 50], [250, 405, 54], [350, 410, 46]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
    <rect y="430" width="${W}" height="${H - 430}" fill="url(#k-grass)"/>
    <path d="M150 700 C180 600 230 520 260 430 L290 430 C280 520 280 600 330 700z" fill="#dcc79c"/>
    <g transform="translate(40 470)"><rect width="110" height="10" rx="3" fill="#7a5233"/><rect y="-26" width="110" height="9" rx="3" fill="#7a5233"/><path d="M10 10v26M100 10v26" stroke="#3a3a3a" stroke-width="5"/></g>`,

  restaurant: () => `
    <defs>${grad('r-bg', [[0, '#26161a'], [1, '#5c2f26']])}<radialGradient id="r-glow"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".85"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#r-bg)"/>
    ${[40, 220].map((x) => `<rect x="${x}" y="90" width="140" height="250" rx="70" fill="#1b2a52" stroke="#3a2420" stroke-width="10"/>${[0, 1, 2, 3, 4].map((i) => `<circle cx="${x + 20 + i * 25}" cy="${170 + (i % 2) * 40}" r="2" fill="#ffe9b0"/>`).join('')}`).join('')}
    ${[70, 200, 330].map((x) => `<circle cx="${x}" cy="60" r="60" fill="url(#r-glow)" opacity=".7"/><circle cx="${x}" cy="60" r="8" fill="#ffe2a6"/><path d="M${x} 0v52" stroke="#1a0f0f" stroke-width="2"/>`).join('')}
    <rect y="520" width="${W}" height="180" fill="#f1ebe1"/><rect y="520" width="${W}" height="10" fill="#d8cfc2"/>
    <g transform="translate(200 470)"><circle r="60" fill="url(#r-glow)" opacity=".7"/><rect x="-7" y="10" width="14" height="40" rx="3" fill="#fbf4e6"/><path d="M0 -4c6 6 4 12 0 14-4-2-6-8 0-14z" fill="#ffcf5a"/></g>`,

  meeting: () => `
    <defs>${grad('m-wall', [[0, '#dfe5f3'], [1, '#bfcae4']])}</defs>
    <rect width="${W}" height="${H}" fill="url(#m-wall)"/>
    <rect x="30" y="110" width="200" height="150" rx="6" fill="#fff" stroke="#9aa6c4" stroke-width="5"/>
    <g fill="none" stroke-width="3" stroke-linecap="round"><path d="M50 150h90" stroke="#2f6fe0"/><path d="M50 175h130" stroke="#7a8db8"/><path d="M50 200h60" stroke="#7a8db8"/><path d="M130 230l22-30 20 18 30-40" stroke="#13999b"/></g>
    <rect x="250" y="110" width="130" height="90" rx="6" fill="#1f2640"/><rect x="258" y="118" width="114" height="74" rx="3" fill="#2f6fe0" opacity=".6"/>
    <rect x="0" y="420" width="${W}" height="${H - 420}" fill="#9aa6c4"/>
    <path d="M-20 560 L420 520 L420 700 L-20 700z" fill="#6b4a33"/><path d="M-20 560 L420 520" stroke="#87603f" stroke-width="8"/>
    ${[50, 340].map((x) => `<rect x="${x - 26}" y="430" width="52" height="80" rx="16" fill="#2b3350"/>`).join('')}`,

  street: () => `
    <defs>${grad('s-sky', [[0, '#ff9f7a'], [0.6, '#ffd3a1'], [1, '#ffe7c4']])}</defs>
    <rect width="${W}" height="${H}" fill="url(#s-sky)"/>
    ${[[0, 120, 130, '#c46a4c'], [130, 200, 120, '#e3ad70'], [250, 90, 150, '#7b8db3']].map(([x, y, w, c], k) => `<rect x="${x}" y="${y}" width="${w}" height="${H - y}" fill="${c}"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect x="${x + 16 + (i % 3) * ((w - 32) / 3)}" y="${y + 24 + Math.floor(i / 3) * 70}" width="${(w - 32) / 3 - 10}" height="44" rx="3" fill="${(i + k) % 4 ? '#3a3550' : '#ffe0a0'}" opacity=".85"/>`).join('')}`).join('')}
    <rect x="160" y="420" width="60" height="100" rx="4" fill="#4a2d22"/>
    <rect y="520" width="${W}" height="180" fill="#a7a9b2"/><rect y="520" width="${W}" height="8" fill="#c7c9d0"/>
    <g transform="translate(355 300)"><rect x="-3" y="0" width="6" height="230" fill="#2b2b33"/><path d="M-16 -10h32l-6 14h-20z" fill="#2b2b33"/><circle cy="10" r="16" fill="#ffe6a0" opacity=".35"/></g>`,
};

export const SCENE_NAMES = Object.keys(SCENES);

export function backdrop(name) {
  const draw = SCENES[name] || SCENES.office;
  return `<svg class="backdrop" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${draw()}</svg>`;
}
