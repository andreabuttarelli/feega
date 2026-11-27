import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { mix } from "../ease";
import { exitProgress } from "./motion";
import { TONES, Tone } from "./style";

export enum Ending {
  Regroup = "regroup",
  Hold = "hold",
}

const PUSH = 0.035;
const EXIT_SHIFT = 140;
const EXIT_SHRINK = 0.06;

export const Section = ({ tone, ending = Ending.Regroup, children }: { tone: Tone; ending?: Ending; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const colors = TONES[tone];
  const out = ending === Ending.Regroup ? exitProgress(frame, durationInFrames) : 0;
  const scale = mix(1, 1 + PUSH, frame / durationInFrames) - EXIT_SHRINK * out;

  return (
    <AbsoluteFill style={{ background: colors.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${-EXIT_SHIFT * out}px) scale(${scale})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Place = ({ x, y, children, style }: { x: number; y: number; children: ReactNode; style?: React.CSSProperties }) => (
  <div style={{ position: "absolute", left: x, top: y, ...style }}>{children}</div>
);
