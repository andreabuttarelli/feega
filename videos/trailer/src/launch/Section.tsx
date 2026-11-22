import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { lift, mix } from "../ease";
import { MONO, ORANGE, TONES, Tone } from "./style";

const PUSH = 0.035;

export const Section = ({ tone, eyebrow, children }: { tone: Tone; eyebrow?: string; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const colors = TONES[tone];
  const scale = mix(1, 1 + PUSH, frame / durationInFrames);
  const eyebrowIn = lift(frame, 2, 12);

  return (
    <AbsoluteFill style={{ background: colors.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>
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
