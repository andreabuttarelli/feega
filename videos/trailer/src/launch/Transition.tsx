import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { glide } from "../ease";
import { Landscape } from "./Landscape";
import { noise } from "./motion";
import { useStage } from "./stage";

export enum Exit {
  Pixels = "pixels",
  Panel = "panel",
  Cut = "cut",
  Landscape = "landscape",
}

export const WIPE_FRAMES = 12;
export const LANDSCAPE_FRAMES = 20;

const LANDSCAPE_RISE = 0.7;

const CELL = 80;
const RAGGED = 0.3;
const STEP = 40;
const STAIRS = 6;

const PixelWipe = ({ progress, color }: { progress: number; color: string }) => {
  const { width, height } = useStage();
  const COLS = Math.ceil(width / CELL);
  const ROWS = Math.ceil(height / CELL);

  return (
  <svg width={COLS * CELL} height={ROWS * CELL} viewBox={`0 0 ${COLS} ${ROWS}`} shapeRendering="crispEdges" style={{ position: "absolute", inset: 0 }}>
    {Array.from({ length: COLS * ROWS }, (_, i) => {
      const x = i % COLS;
      const y = Math.floor(i / COLS);
      const threshold = (x / COLS) * (1 - RAGGED) + noise(i + 1) * RAGGED;

      return progress > threshold ? <rect key={i} x={x} y={y} width={1} height={1} fill={color} /> : null;
    })}
  </svg>
  );
};

const PanelSlide = ({ progress, color }: { progress: number; color: string }) => {
  const { width, height } = useStage();
  const reach = STEP * STAIRS;
  const x = (1 - progress) * (width + reach);

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: width + reach, height, transform: `translateX(${x}px)` }}>
      {Array.from({ length: STAIRS }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: (STAIRS - i - 1) * STEP, top: (i * height) / STAIRS, width: width + reach, height: height / STAIRS + 1, background: color }} />
      ))}
    </div>
  );
};

const LandscapeWipe = ({ progress, color }: { progress: number; color: string }) => {
  const { width, height } = useStage();
  const rise = Math.min(progress / LANDSCAPE_RISE, 1);
  const flood = Math.max((progress - LANDSCAPE_RISE) / (1 - LANDSCAPE_RISE), 0);

  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - rise) * height}px)` }}>
        <Landscape cols={width / 10} rows={height / 10} seed={4} width={width} height={height} />
      </div>
      <PixelWipe progress={flood * 1.02} color={color} />
    </>
  );
};

const WIPES: Record<Exclude<Exit, Exit.Cut>, (props: { progress: number; color: string }) => ReactNode> = {
  [Exit.Pixels]: ({ progress, color }) => <PixelWipe progress={progress * 1.02} color={color} />,
  [Exit.Panel]: PanelSlide,
  [Exit.Landscape]: LandscapeWipe,
};

export const ExitWipe = ({ exit, color }: { exit: Exit; color: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const span = exit === Exit.Landscape ? LANDSCAPE_FRAMES : WIPE_FRAMES;
  const progress = glide(frame, durationInFrames - span, span);

  const Wipe = exit === Exit.Cut ? null : WIPES[exit];

  if (!Wipe || progress <= 0) {
    return null;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Wipe progress={progress} color={color} />
    </AbsoluteFill>
  );
};
