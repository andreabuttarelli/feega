import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { glide } from "../ease";
import { noise } from "./motion";

export enum Exit {
  Pixels = "pixels",
  Panel = "panel",
  Cut = "cut",
}

export const WIPE_FRAMES = 12;

const CELL = 80;
const COLS = 24;
const ROWS = 14;
const RAGGED = 0.3;
const STEP = 40;
const STAIRS = 6;

const PixelWipe = ({ progress, color }: { progress: number; color: string }) => (
  <svg width={COLS * CELL} height={ROWS * CELL} viewBox={`0 0 ${COLS} ${ROWS}`} shapeRendering="crispEdges" style={{ position: "absolute", inset: 0 }}>
    {Array.from({ length: COLS * ROWS }, (_, i) => {
      const x = i % COLS;
      const y = Math.floor(i / COLS);
      const threshold = (x / COLS) * (1 - RAGGED) + noise(i + 1) * RAGGED;

      return progress > threshold ? <rect key={i} x={x} y={y} width={1} height={1} fill={color} /> : null;
    })}
  </svg>
);

const PanelSlide = ({ progress, color }: { progress: number; color: string }) => {
  const reach = STEP * STAIRS;
  const x = (1 - progress) * (1920 + reach);

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: 1920 + reach, height: 1080, transform: `translateX(${x}px)` }}>
      {Array.from({ length: STAIRS }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: (STAIRS - i - 1) * STEP, top: (i * 1080) / STAIRS, width: 1920 + reach, height: 1080 / STAIRS + 1, background: color }} />
      ))}
    </div>
  );
};

export const ExitWipe = ({ exit, color }: { exit: Exit; color: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = glide(frame, durationInFrames - WIPE_FRAMES, WIPE_FRAMES);

  if (exit === Exit.Cut || progress <= 0) {
    return null;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {exit === Exit.Pixels ? <PixelWipe progress={progress * 1.02} color={color} /> : <PanelSlide progress={progress} color={color} />}
    </AbsoluteFill>
  );
};
