import { useCurrentFrame } from "remotion";
import { lift } from "../ease";

const PALETTE: Record<string, string> = {
  "#": "#ff5100",
  o: "#ff8a3d",
  b: "#004dff",
  n: "#0038a8",
  g: "#8a8780",
  w: "#f0eee9",
  k: "#0b0b0a",
};

export const SPRITES = {
  blob: ["..####..", ".######.", "#ww##ww#", "#wk##wk#", "########", "###oo###", ".######.", ".#....#."],
  pointer: ["k.......", "kk......", "kwk.....", "kwwk....", "kwwwk...", "kwwwwk..", "kwwkkk..", "kk.kwk..", "....kk.."],
  brush: ["......##", ".....###", "....###.", "...###..", "..###...", ".##o....", "##......"],
  layers: ["..bbbb..", ".b....b.", "b..oo..b", "b.oooo.b", "b..oo..b", ".b....b.", "..bbbb.."],
  plug: ["..b..b..", "..b..b..", ".######.", ".#oooo#.", ".#oooo#.", "..####..", "...##..."],
  frame: ["########", "#oooooo#", "########", "#.#bbb#.", "#.#bbb#.", "#.#####.", "........"],
  mesh: ["bbbooo##", "bbboooo#", "nbbbooo#", "nnbbooo#", "nnnbboo#", "nnnnbboo", "nnnnnbbo"],
  cube: ["...bb...", "..bbbb..", ".bbbnnb.", "bbbnnnnb", "bbnnnnn.", ".bnnnn..", "..nnn..."],
  ghost: ["..bbbb..", ".bbbbbb.", "bwwbbwwb", "bwkbbwkb", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb", "b.bb.bb."],
  star: ["...#....", "...#....", "#######.", ".#####..", "..###...", ".##.##..", "#.....#."],
} satisfies Record<string, string[]>;

export type Sprite = keyof typeof SPRITES;

export const CREW: Sprite[] = ["blob", "ghost", "pointer", "brush", "layers", "blob", "plug", "frame", "ghost", "cube", "star"];

export const Pixel = ({ sprite, size }: { sprite: Sprite; size: number }) => {
  const rows = SPRITES[sprite];
  const width = Math.max(...rows.map((r) => r.length));

  return (
    <svg width={width * size} height={rows.length * size} viewBox={`0 0 ${width} ${rows.length}`} shapeRendering="crispEdges" style={{ display: "block" }}>
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => (PALETTE[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PALETTE[ch]} /> : null)),
      )}
    </svg>
  );
};

const HOP_PERIOD = 14;
const HOP_HEIGHT = 16;

export const hop = (frame: number, phase: number) => {
  const t = ((frame + phase) % HOP_PERIOD) / HOP_PERIOD;
  return -HOP_HEIGHT * Math.sin(Math.PI * t) ** 2;
};

export const Parade = ({ sprites, size, start, gap, stagger }: { sprites: Sprite[]; size: number; start: number; gap: number; stagger: number }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", gap, alignItems: "flex-end" }}>
      {sprites.map((s, i) => {
        const at = start + i * stagger;
        const p = lift(frame, at, 8);
        const y = (1 - p) * 90 + (frame > at + 8 ? hop(frame, i * 5) : 0);

        return (
          <div key={i} style={{ transform: `translateY(${y}px) scale(${p})`, transformOrigin: "bottom center" }}>
            <Pixel sprite={s} size={size} />
          </div>
        );
      })}
    </div>
  );
};

export type Speck = { x: number; y: number; s: number; c: string; at: number };

export const Scatter = ({ specks }: { specks: Speck[] }) => {
  const frame = useCurrentFrame();

  return (
    <>
      {specks.map((d, i) => {
        const visible = frame >= d.at && Math.floor((frame - d.at) / 9 + i) % 6 !== 0;

        return visible ? <div key={i} style={{ position: "absolute", left: d.x, top: d.y, width: d.s, height: d.s, background: d.c }} /> : null;
      })}
    </>
  );
};

export const specks = (seed: number, count: number, colors: string[]): Speck[] =>
  Array.from({ length: count }, (_, i) => {
    const r = (k: number) => {
      const v = Math.sin(seed * 97.1 + i * 12.9898 + k * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };

    return { x: r(1) * 1860 + 20, y: r(2) * 1020 + 20, s: 10 + Math.floor(r(3) * 3) * 6, c: colors[i % colors.length], at: Math.floor(r(4) * 30) };
  });
