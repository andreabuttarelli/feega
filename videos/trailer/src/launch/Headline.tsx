import { interpolate, useCurrentFrame } from "remotion";
import { lift, tween } from "../ease";
import { useOnBeat } from "./beat";
import { noise } from "./motion";
import { DISPLAY, TONES, Tone } from "./style";

export enum Align {
  Center = "center",
  Left = "left",
}

export const ASSEMBLE = {
  scatterX: 3.2,
  scatterY: 1.5,
  tilt: 8,
  scaleSpread: 0.2,
  hold: 2,
  duration: 12,
  lag: 4,
};

const BOX_WIPE = 4;
const BOXED_GROW = 0.06;

type Scatter = { x: number; y: number; tilt: number; scale: number; lag: number };

const seedOf = (lines: string[]) => [...lines.join(" ")].reduce((sum, ch, i) => sum + ch.charCodeAt(0) * (i + 1), 0);

const scatterOf = (seed: number, word: number): Scatter => {
  const r = (k: number) => noise(seed + word * 7.31 + k * 1.77) * 2 - 1;

  return {
    x: r(1) * ASSEMBLE.scatterX,
    y: r(2) * ASSEMBLE.scatterY,
    tilt: r(3) * ASSEMBLE.tilt,
    scale: 1 + r(4) * ASSEMBLE.scaleSpread,
    lag: Math.round(((r(5) + 1) / 2) * ASSEMBLE.lag),
  };
};

const stepped = (frame: number, start: number) => start + Math.floor((frame - start) / ASSEMBLE.hold) * ASSEMBLE.hold;

const landing = (frame: number, start: number, lag: number) => 1 - (1 - interpolate(stepped(frame, start), [start + lag, start + ASSEMBLE.duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })) ** 2;

export const boxPopAt = (start = 0) => start + ASSEMBLE.duration;

export const assembleTicks = (start = 0) => Array.from({ length: ASSEMBLE.duration / ASSEMBLE.hold }, (_, i) => start + i * ASSEMBLE.hold);

export const Headline = ({ lines, boxed, tone, size, align, start = 0 }: { lines: string[]; boxed: string; tone: Tone; size: number; align: Align; start?: number }) => {
  const frame = useCurrentFrame();
  const colors = TONES[tone];
  const boxAt = useOnBeat()(boxPopAt(start));
  const box = tween(frame, boxAt, BOX_WIPE);
  const grow = lift(frame, boxAt, 8);
  const seed = seedOf(lines);
  let index = 0;

  return (
    <div style={{ fontFamily: DISPLAY, fontSize: size, fontWeight: 560, letterSpacing: "-0.05em", lineHeight: 1.04, color: colors.fg }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", justifyContent: align === Align.Center ? "center" : "flex-start", gap: "0.22em" }}>
          {line.split(" ").map((word, wi) => {
            const from = scatterOf(seed, index++);
            const away = 1 - landing(frame, start, from.lag);
            const isBoxed = word.startsWith(boxed);
            const label = isBoxed ? boxed : word;
            const trail = isBoxed ? word.slice(boxed.length) : "";
            const scale = 1 + (from.scale - 1) * away;

            return (
              <span key={wi} style={{ display: "inline-flex", transform: `translate(${from.x * away}em, ${from.y * away}em) rotate(${from.tilt * away}deg) scale(${scale})` }}>
                <span style={{ position: "relative", padding: isBoxed ? "0 0.06em" : 0, display: "inline-block", transform: isBoxed ? `scale(${1 + BOXED_GROW * grow})` : undefined }}>
                  {isBoxed ? <span style={{ position: "absolute", inset: "0.1em 0 0.02em", background: colors.box, transform: `scale(${box})`, transformOrigin: "left center" }} /> : null}
                  <span style={{ position: "relative", color: isBoxed && box > 0.4 ? colors.boxFg : colors.fg }}>{label}</span>
                </span>
                <span style={{ position: "relative" }}>{trail}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
