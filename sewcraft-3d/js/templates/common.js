// Shared wording for the step scripts. Every helper takes the step context
// `c` (ctx + `u` = the step's machine setup + `M` = machine profile).
import { fmtSpi } from '../engine/units.js';

export const b = (s) => `<strong>${s}</strong>`;

/** "Consew 2206RB-14-7DD-1 · 135x17 · Nm 125 / #20 · Tex 70 · 7 SPI (3.6 mm)" */
export function machineLine(c) {
  const u = c.u;
  return `${b(u.machineName)} · ${u.needle} ${u.point.split(' ')[0]} · Tex ${u.tex} (${u.threadV}) top, Tex ${u.bobbinTex} bobbin · ${fmtSpi(u.spi, c.unit)}`;
}

export function startStop(c) {
  const u = c.u;
  if (u.machine === '2206RB') {
    const bt = u.program.startBT;
    if (bt.startsWith('Off')) return `Auto backtack ${b('off')} for this seam — ${bt.replace(/^Off — /, '').replace(/^Off$/, 'leave the ends unlocked')}.`;
    return `Auto backtack ${b(bt)} at both ends; heel back fully to trim.`;
  }
  return `Backtack 3 stitches at both ends with the reverse lever${c.mat.group === 'Leather' ? ' (or tie the tails off by hand on leather)' : ''}.`;
}

export function pivotHow(c) {
  return c.u.machine === '2206RB'
    ? 'stop needle-down, half-heel to lift the feet, turn the work, lower and continue'
    : 'stop with the needle down, lift the foot with the knee lifter, turn, lower and continue';
}

export function speedNote(c) {
  return `Cap the speed around ${b(`${c.u.speed} SPM`)}.`;
}

export function liftNote(c) {
  return c.u.altLift ? ` Alternating foot lift: ${c.u.altLift.toLowerCase()}.` : '';
}

export function holdNote(c, fabric = 'main') {
  const m = fabric === 'lining' && c.lin ? c.lin : c.mat;
  return m.hold;
}

export function changeover(c) {
  return c.s.changeover ? `<span class="changeover">Changeover first: ${c.s.changeover}.</span> ` : '';
}

/** Standard closing for an execution paragraph. */
export function execTail(c) {
  return `${startStop(c)} ${speedNote(c)}${liftNote(c)}`;
}

/** Camera presets in degrees, relative to the rig origin. */
export const cam = (target, dist, az = 35, el = 28) => ({ target, dist, az, el });
/** Camera that frames everything visible at the end of the step. */
export const fitCam = (az = 0, el = 60, pad = 1.02) => ({ target: [0, 0, 0], dist: 1, az, el, fit: pad });

/** Path of a box-X tack in a (s, a) strap coordinate system. */
export function boxX(s0, s1, a0, a1) {
  return [
    [s0, a0], [s1, a0], [s1, a1], [s0, a1], [s0, a0],
    [s1, a1], [s1, a0], [s0, a1],
  ];
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
/** Remap t from [a, b] to [0, 1], clamped. */
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
