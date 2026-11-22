import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { lift, mix } from "../ease";
import { exitProgress } from "./motion";
import { MONO, ORANGE, TONES, Tone } from "./style";

export enum Ending {
  Regroup = "regroup",
  Hold = "hold",
}

const PUSH = 0.035;
const EXIT_SHIFT = 140;
const EXIT_SHRINK = 0.06;

export const Section = ({ tone, eyebrow, ending = Ending.Regroup, children }: { tone: Tone; eyebrow?: string; ending?: Ending; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const colors = TONES[tone];
  const out = ending === Ending.Regroup ? exitProgress(frame, durationInFrames) : 0;
  const scale = mix(1, 1 + PUSH, frame / durationInFrames) - EXIT_SHRINK * out;
  const eyebrowIn = lift(frame, 2, 12);

  return (
    <AbsoluteFill style={{ background: colors.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${-EXIT_SHIFT * out}px) scale(${scale})` }}>{children}</AbsoluteFill>
      {eyebrow ? (
        <div style={{ position: "absolute", left: 100, top: 72, display: "flex", alignItems: "center", gap: 14, fontFamily: MONO, fontSize: 22, color: colors.muted, opacity: eyebrowIn, transform: `translateX(${(1 - eyebrowIn) * -20}px)` }}>
          <span style={{ width: 14, height: 14, background: tone === Tone.Orange ? colors.fg : ORANGE }} />
          {eyebrow}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const Place = ({ x, y, children, style }: { x: number; y: number; children: ReactNode; style?: React.CSSProperties }) => (
  <div style={{ position: "absolute", left: x, top: y, ...style }}>{children}</div>
);
