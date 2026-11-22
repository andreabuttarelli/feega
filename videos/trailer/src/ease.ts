import { Easing, interpolate } from "remotion";

const expoInOut = Easing.bezier(0.87, 0, 0.13, 1);
const SETTLE = 0.012;
const SETTLE_FROM = 0.75;

export const settle = (p: number) => {
  const t = Math.min(Math.max(p, 0), 1);
  const tail = Math.max(0, (t - SETTLE_FROM) / (1 - SETTLE_FROM));

  return expoInOut(t) + SETTLE * Math.sin(Math.PI * tail);
};

export const tween = (frame: number, start: number, duration: number) => {
  const p = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return settle(p);
};

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
