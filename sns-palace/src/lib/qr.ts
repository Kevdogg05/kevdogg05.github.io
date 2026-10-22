// QR codes as a single SVG path: crisp at any size, no canvas, no images.

import { encode } from "uqr";

export interface QrShape {
  /** Width and height in modules, quiet zone included. */
  size: number;
  /** Dark modules as unit squares, with horizontal runs merged. */
  path: string;
}

/** Encodes `text` (medium error correction) with a `border`-module quiet zone. */
export function qrShape(text: string, border = 4): QrShape {
  const { data, size } = encode(text, { ecc: "M", border });
  let path = "";
  data.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let run = 1;
      while (row[x + run]) run += 1;
      path += `M${x} ${y}h${run}v1h-${run}z`;
      x += run - 1;
    }
  });
  return { size, path };
}
