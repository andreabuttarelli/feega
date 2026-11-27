import { noise } from "./motion";

const GLYPHS: Record<string, string[]> = {
  p: [".....", ".....", "####.", "#...#", "#...#", "#...#", "####.", "#....", "#...."],
  l: ["#", "#", "#", "#", "#", "#", "#", ".", "."],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#...#", ".####", ".....", "....."],
  g: [".....", ".....", ".####", "#...#", "#...#", "#...#", ".####", "....#", "####."],
  i: ["#", ".", "#", "#", "#", "#", "#", ".", "."],
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#", ".....", "....."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####.", ".....", "....."],
};

const ROWS = 9;
const KERN = 1;

export type Block = { x: number; y: number; seed: number };

export const wordBlocks = (word: string) => {
  let left = 0;
  const blocks: Block[] = [];

  for (const ch of word) {
    const rows = GLYPHS[ch];
    const width = Math.max(...rows.map((r) => r.length));

    rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c === "#") {
          blocks.push({ x: left + x, y, seed: noise(blocks.length + 7) });
        }
      }),
    );
    left += width + KERN;
  }

  return { blocks, cols: left - KERN, rows: ROWS };
};

export const PixelWord = ({ word, cell, color, scaleOf }: { word: string; cell: number; color: string; scaleOf: (b: Block) => number }) => {
  const { blocks, cols, rows } = wordBlocks(word);

  return (
    <div style={{ position: "relative", width: cols * cell, height: rows * cell }}>
      {blocks.map((b, i) => {
        const s = scaleOf(b);

        return s > 0 ? <i key={i} style={{ position: "absolute", left: b.x * cell, top: b.y * cell, width: cell + 1, height: cell + 1, background: color, transform: `scale(${s})` }} /> : null;
      })}
    </div>
  );
};
