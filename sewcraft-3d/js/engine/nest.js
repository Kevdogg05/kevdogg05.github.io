// Cutting-layout estimate: a first-fit shelf packer. Pieces are bounding boxes
// of the cut outlines; `w` runs across the roll, `h` along it. It is a
// conservative estimate — a hand-made marker will usually beat it a little.

export function nest(pieces, rollWidth) {
  const items = [];
  for (const p of pieces) {
    for (let i = 0; i < p.qty; i++) {
      let w = p.w;
      let h = p.h;
      // Long strips and anything wider than the roll go lengthwise when the grain allows.
      if ((w > rollWidth || (w > h * 2 && p.rotatable)) && p.rotatable) [w, h] = [h, w];
      items.push({ ...p, w, h, n: i + 1, oversize: w > rollWidth + 1e-6 });
    }
  }
  items.sort((a, b) => b.h - a.h || b.w - a.w);

  const gap = 0.25;
  const shelves = [];
  const placed = [];
  for (const it of items) {
    if (it.oversize) {
      placed.push({ ...it, x: 0, y: null });
      continue;
    }
    let shelf = shelves.find((s) => s.used + it.w <= rollWidth + 1e-6 && it.h <= s.h + 1e-6);
    if (!shelf) {
      const y = shelves.reduce((acc, s) => acc + s.h + gap, 0);
      shelf = { y, h: it.h, used: 0 };
      shelves.push(shelf);
    }
    placed.push({ ...it, x: shelf.used, y: shelf.y });
    shelf.used += it.w + gap;
  }
  let length = shelves.reduce((acc, s) => acc + s.h + gap, 0);
  // Oversize pieces (wider than the roll) are pieced: lay them after the shelves.
  for (const p of placed.filter((q) => q.y === null)) {
    p.y = length;
    length += p.h + gap;
  }
  return { placed, length, rollWidth };
}

/** Yards to buy: nest length + 10 % for squaring, shrinkage and flaws. */
export function yardsToBuy(lengthIn) {
  return (lengthIn * 1.1) / 36;
}

/** Hide area to buy for leather, in square feet (30 % allowance for hide shape and flaws). */
export function sqFtToBuy(areaIn2) {
  return (areaIn2 * 1.3) / 144;
}
