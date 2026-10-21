// Length formatting. Every measurement inside the app is stored in inches;
// these helpers turn them into shop-floor strings in either unit system.

const FRACTIONS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

/** Inches → "16½″" (nearest ⅛) or "41.9 cm". */
export function fmtLen(inches, unit = 'in') {
  if (!Number.isFinite(inches)) return '—';
  if (unit === 'cm') {
    const cm = inches * 2.54;
    return `${cm >= 100 ? Math.round(cm) : trimZero(cm.toFixed(1))} cm`;
  }
  const neg = inches < 0;
  let eighths = Math.round(Math.abs(inches) * 8);
  const whole = Math.floor(eighths / 8);
  eighths -= whole * 8;
  const body = whole === 0 && eighths ? FRACTIONS[eighths] : `${whole}${FRACTIONS[eighths]}`;
  return `${neg ? '−' : ''}${body}″`;
}

/** Two lengths as "W × H". */
export function fmtSize(w, h, unit = 'in') {
  if (unit === 'cm') return `${fmtNum(w * 2.54)} × ${fmtNum(h * 2.54)} cm`;
  return `${fmtLen(w, unit)} × ${fmtLen(h, unit)}`;
}

/** Millimetres with an inch hint, used for material thickness and stack height. */
export function fmtMm(mm, unit = 'in') {
  const m = trimZero(mm.toFixed(mm < 10 ? 1 : 0));
  if (unit === 'cm') return `${m} mm`;
  const sixtyFourths = Math.max(1, Math.round((mm / 25.4) * 64));
  return `${m} mm (${reduceFrac(sixtyFourths, 64)}″)`;
}

export function fmtNum(n) {
  return trimZero((Math.round(n * 10) / 10).toFixed(1));
}

/** Stitches per inch → stitch length in mm. */
export const spiToMm = (spi) => 25.4 / spi;

export function fmtSpi(spi, unit = 'in') {
  const mm = trimZero(spiToMm(spi).toFixed(1));
  return unit === 'cm' ? `${mm} mm stitch (${fmtNum(spi)} SPI)` : `${fmtNum(spi)} SPI (${mm} mm)`;
}

/** Yards of goods, rounded up to the next ⅛ yd. */
export function fmtYards(yards, unit = 'in') {
  if (unit === 'cm') return `${trimZero((Math.ceil(yards * 0.9144 * 10) / 10).toFixed(1))} m`;
  const eighths = Math.ceil(yards * 8);
  const whole = Math.floor(eighths / 8);
  const rest = eighths - whole * 8;
  return `${whole ? whole : ''}${FRACTIONS[rest]}${whole || rest ? '' : '0'} yd`;
}

export function inchesFromInput(value, unit) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return NaN;
  return unit === 'cm' ? n / 2.54 : n;
}

export function inputFromInches(inches, unit) {
  return unit === 'cm' ? Math.round(inches * 2.54 * 10) / 10 : Math.round(inches * 8) / 8;
}

function reduceFrac(num, den) {
  const g = gcd(num, den);
  const n = num / g;
  const d = den / g;
  if (d === 1) return String(n);
  if (n > d) return `${Math.floor(n / d)} ${n % d}/${d}`;
  return `${n}/${d}`;
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

function trimZero(s) {
  return s.replace(/\.0$/, '');
}
