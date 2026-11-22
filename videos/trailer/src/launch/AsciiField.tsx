import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame } from "remotion";

type Rgb = [number, number, number];

const RAMP = " .:-=+*#%@";
const RAINBOW = ["#E40303", "#FF8C00", "#FFED00", "#008026", "#004DFF", "#750787"];
const WAVES = [
  { kx: 0.11, ky: 0.07, r: 1.6, off: 0 },
  { kx: -0.06, ky: 0.13, r: 1.2, off: 1.7 },
  { kx: 0.04, ky: -0.09, r: 2.1, off: 3.1 },
];
const TAU = Math.PI * 2;
const LOOP_FRAMES = 720;
const CELL = 16;
const SCALE = 0.09;
const MIN_PEAK = 200;
const EDGE_FLOOR = 0.6;
const WIDTH = 1920;
const HEIGHT = 1080;
const COLS = Math.ceil(WIDTH / CELL);
const ROWS = Math.ceil(HEIGHT / CELL);

const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

const STOPS = RAINBOW.map(parse);

const lifted = (rgb: Rgb) => {
  const gain = Math.max(1, MIN_PEAK / Math.max(...rgb));
  return rgb.map((v) => Math.min(255, Math.round(v * gain)));
};

const tint = (t: number, shift: number) => {
  const p = (((t + shift) % 1) + 1) % 1 * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(p));
  const f = p - i;
  const [r, g, b] = lifted([0, 1, 2].map((k) => STOPS[i][k] + (STOPS[i + 1][k] - STOPS[i][k]) * f) as Rgb);
  return `rgb(${r},${g},${b})`;
};

const fieldAt = (x: number, y: number, phase: number) => {
  const a = phase * TAU;
  const cx = Math.cos(a);
  const sy = Math.sin(a);
  let sum = 0;

  for (const w of WAVES) {
    const warp = Math.sin(y * 0.05 + w.r * sy + w.off) * 2;
    sum += Math.sin((x + warp) * w.kx + y * w.ky + w.r * cx + w.off);
  }

  return (sum / WAVES.length + 1) / 2;
};

const envelope = (nx: number, ny: number) => {
  const r = Math.min(1, Math.hypot((nx - 0.5) * 2, (ny - 0.5) * 2) / Math.SQRT2);
  return 1 - r * r * (3 - 2 * r);
};

export const AsciiField = ({ fade, strength = 1 }: { fade: string; strength?: number }) => {
  const frame = useCurrentFrame();
  const canvas = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    const phase = frame / LOOP_FRAMES;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.font = `${CELL}px "Fragment Mono", Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let c = 0; c < COLS; c++) {
      const nx = (c + 0.5) / COLS;

      for (let row = 0; row < ROWS; row++) {
        const ny = (row + 0.5) / ROWS;
        const e = envelope(nx, ny);
        const d = Math.sqrt(fieldAt(c * CELL * SCALE, row * CELL * SCALE, phase)) * (EDGE_FLOOR + (1 - EDGE_FLOOR) * e);
        const glyph = RAMP[Math.round(Math.min(1, d) * (RAMP.length - 1))];

        if (glyph === " ") {
          continue;
        }

        ctx.fillStyle = tint(1 - e, phase);
        ctx.globalAlpha = (0.25 + d * 0.45) * strength;
        ctx.fillText(glyph, c * CELL + CELL / 2, row * CELL + CELL / 2);
      }
    }
  }, [frame, strength]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 46% 40% at 50% 46%, ${fade} 0%, ${fade} 45%, transparent 100%)` }} />
    </div>
  );
};
