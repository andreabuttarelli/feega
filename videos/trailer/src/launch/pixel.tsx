import { useCurrentFrame } from "remotion";
import { lift } from "../ease";
import { float } from "./motion";

const SPECK_DEPTH = 10;

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
  cursor: ["k.......", "kk......", "kwk.....", "kwwk....", "kwwwk...", "kwwwwk..", "kwwkkk..", "kk.kwk..", "....kk.."],
  brush: ["......##", ".....###", "....###.", "...###..", "..###...", ".##o....", "##......"],
  layers: ["..bbbb..", ".b....b.", "b..oo..b", "b.oooo.b", "b..oo..b", ".b....b.", "..bbbb.."],
  plug: ["..b..b..", "..b..b..", ".######.", ".#oooo#.", ".#oooo#.", "..####..", "...##..."],
  frame: ["########", "#oooooo#", "########", "#.#bbb#.", "#.#bbb#.", "#.#####.", "........"],
  mesh: ["bbbooo##", "bbboooo#", "nbbbooo#", "nnbbooo#", "nnnbboo#", "nnnnbboo", "nnnnnbbo"],
  cube: ["...bb...", "..bbbb..", ".bbbnnb.", "bbbnnnnb", "bbnnnnn.", ".bnnnn..", "..nnn..."],
  star: ["...#....", "...#....", "#######.", ".#####..", "..###...", ".##.##..", "#.....#."],
  spark: ["...#....", "..###...", ".#####..", "#######.", "..o.o...", ".o.o.o..", "........"],
  palette: ["..####..", ".#oooo#.", "#obo#on#", "#oooooo#", "#ow...o#", ".#o..#..", "..###..."],
  code: ["...........", "..b...#.b..", ".b...#...b.", "b....#....b", ".b..#....b.", "..b.#...b.."],
  terminal: ["nnnnnnnn", "n......n", "n.w....n", "n..w...n", "n.w.##.n", "n......n", "nnnnnnnn"],
  folder: ["###.....", "#oo#####", "#oooooo#", "#oooooo#", "#oooooo#", "########"],
} satisfies Record<string, string[]>;

export type Sprite = keyof typeof SPRITES;

export const ICONS: Sprite[] = ["cursor", "layers", "brush", "palette", "code", "plug", "frame", "star", "terminal", "folder", "mesh"];

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
const HOP_HEIGHT = 8;

export const hop = (frame: number, phase: number) => {
  const t = ((frame + phase) % HOP_PERIOD) / HOP_PERIOD;
  return -HOP_HEIGHT * Math.sin(Math.PI * t) ** 2;
};

export const IconRow = ({ sprites, size, start, gap, stagger }: { sprites: Sprite[]; size: number; start: number; gap: number; stagger: number }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", gap, alignItems: "flex-end" }}>
      {sprites.map((s, i) => {
        const at = start + i * stagger;
        const p = lift(frame, at, 8);
        const y = (1 - p) * 90 + float(frame, i * 9, 8);
        const turn = (1 - p) * 90 + float(frame, i * 13, 8);

        return (
          <div key={i} style={{ transform: `translateY(${y}px) rotate(${turn}deg) scale(${p})` }}>
            <Pixel sprite={s} size={size} />
          </div>
        );
      })}
    </div>
  );
};

export enum Heading {
  Right = 1,
  Left = -1,
}

const RUN_HOP = 7;
const RUN_HEIGHT = 12;
const SPIN = 3;
const OFFSTAGE = 200;

export const Tumble = ({ sprite, size, y, from, frames, heading }: { sprite: Sprite; size: number; y: number; from: number; frames: number; heading: Heading }) => {
  const frame = useCurrentFrame();
  const t = (frame - from) / frames;

  if (t < 0 || t > 1) {
    return null;
  }

  const travel = (1920 + 2 * OFFSTAGE) * t;
  const x = heading === Heading.Right ? -OFFSTAGE + travel : 1920 + OFFSTAGE - travel;
  const bounce = -Math.abs(Math.sin(((frame - from) / RUN_HOP) * Math.PI)) * RUN_HEIGHT;

  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translateY(${bounce}px) rotate(${heading * SPIN * (frame - from)}deg)` }}>
      <Pixel sprite={sprite} size={size} />
    </div>
  );
};

export type Speck ={ x: number; y: number; s: number; c: string; at: number };

export const Scatter = ({ specks }: { specks: Speck[] }) => {
  const frame = useCurrentFrame();

  return (
    <>
      {specks.map((d, i) => {
        const visible = frame >= d.at && Math.floor((frame - d.at) / 9 + i) % 6 !== 0;
        const depth = d.s / SPECK_DEPTH;

        return visible ? <div key={i} style={{ position: "absolute", left: d.x, top: d.y, width: d.s, height: d.s, background: d.c, transform: `translate(${-frame * depth}px, ${float(frame, i * 11, 10 * depth)}px)` }} /> : null;
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
