import { useMemo } from "react";

const SKY = ["#0038a8", "#004dff", "#2f6bff", "#ff8a3d", "#ff5100"];
const RIDGES = ["#8a8780", "#5c5b57", "#3a3a37", "#1f1f1e"];
const WATER = ["#0038a8", "#004dff"];
const SUN = "#f0eee9";
const TAU = Math.PI * 2;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export enum Ground {
  Hills = "hills",
  Lake = "lake",
}

const hash = (seed: number, k: number) => {
  const v = Math.sin(seed * 91.7 + k * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

const dithered = (stops: string[], t: number, x: number, y: number) => {
  const p = Math.min(Math.max(t, 0), 0.999) * (stops.length - 1);
  const i = Math.floor(p);
  const pick = p - i > (BAYER[y % 4][x % 4] + 0.5) / 16 ? 1 : 0;
  return stops[Math.min(i + pick, stops.length - 1)];
};

const ridgeAt = (seed: number, layer: number, x: number, cols: number) => {
  const base = 0.5 + layer * 0.1;
  const a = hash(seed, layer) * TAU;
  const n = Math.sin((x / cols) * (3 + layer * 2) + a) * 0.08 + Math.sin((x / cols) * (9 + layer * 3) + a * 2) * 0.035;
  return base + n;
};


const paint = (cols: number, rows: number, seed: number, ground: Ground) => {
  const sun = { x: Math.floor(cols * (0.25 + 0.5 * hash(seed, 9))), y: Math.floor(rows * 0.36), r: Math.max(2, Math.round(rows * 0.09)) };
  const waterline = ground === Ground.Lake ? 0.78 : 2;
  const cells: string[][] = [];

  for (let y = 0; y < rows; y++) {
    const line: string[] = [];
    const ny = y / rows;

    for (let x = 0; x < cols; x++) {
      let color = dithered(SKY, ny / 0.62, x, y);

      if (Math.hypot(x - sun.x, (y - sun.y) * 1.1) <= sun.r) {
        color = SUN;
      }

      for (let layer = 0; layer < RIDGES.length; layer++) {
        if (ny >= ridgeAt(seed, layer, x, cols)) {
          color = (x + y) % 2 && layer < 2 ? RIDGES[layer + 1] : RIDGES[layer];
        }
      }

      if (ny >= waterline) {
        color = dithered(WATER, (ny - waterline) * 5 + (Math.sin(x * 0.7 + y) > 0.6 ? 0.4 : 0), x, y);
      }

      line.push(color);
    }

    cells.push(line);
  }

  return cells;
};

export const Landscape = ({ cols, rows, seed, ground = Ground.Hills, width, height }: { cols: number; rows: number; seed: number; ground?: Ground; width: number | string; height: number | string }) => {
  const runs = useMemo(() => {
    const cells = paint(cols, rows, seed, ground);
    return cells.flatMap((line, y) => {
      const out: { x: number; y: number; w: number; c: string }[] = [];

      for (let x = 0; x < cols; ) {
        let end = x + 1;
        while (end < cols && line[end] === line[x]) {
          end++;
        }
        out.push({ x, y, w: end - x, c: line[x] });
        x = end;
      }

      return out;
    });
  }, [cols, rows, seed, ground]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" shapeRendering="crispEdges" style={{ display: "block" }}>
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  );
};
