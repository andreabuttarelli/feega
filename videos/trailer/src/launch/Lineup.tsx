import type { ReactNode } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { glide, lift, mix, tween } from "../ease";
import { exitProgress, float } from "./motion";
import { Pointer } from "./Pointer";
import { MONO, ORANGE, PAPER, Tone, UI } from "./style";

export type LineupItem = { name: string; icon: ReactNode; mono?: boolean };

export type LineupTiming = { enterFrom: number; enterStep: number; sweepFrom: number; sweepStep: number };

const TILE_STYLE: Record<Tone, { bg: string; line: string; text: string }> = {
  [Tone.Ink]: { bg: "#1a1a19", line: "#2e2e2c", text: PAPER },
  [Tone.Paper]: { bg: "#ffffff", line: "#e4e2dc", text: "#2b2a27" },
  [Tone.Orange]: { bg: "#ffffff", line: "#ffd3bd", text: "#2b2a27" },
};

const FLIP = 85;
const RISE = 160;
const LIT_LIFT = 14;
const DRIFT = 7;
const REGROUP = 0.4;
const POINTER_OFFSET = { x: 40, y: 50 };

export const litAt = (timing: LineupTiming, index: number) => timing.sweepFrom + index * timing.sweepStep;

export const Lineup = ({ items, tone, width, height, gap, timing, label }: { items: LineupItem[]; tone: Tone; width: number; height: number; gap: number; timing: LineupTiming; label: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const style = TILE_STYLE[tone];
  const span = items.length * width + (items.length - 1) * gap;
  const left = (1920 - span) / 2;
  const centerOf = (i: number) => left + i * (width + gap) + width / 2;
  const regroup = exitProgress(frame, durationInFrames);

  const sweepIndex = Math.min(Math.max((frame - timing.sweepFrom) / timing.sweepStep, 0), items.length - 1);
  const from = Math.floor(sweepIndex);
  const within = glide(sweepIndex - from, 0, 1);
  const cursorX = mix(centerOf(from), centerOf(Math.min(from + 1, items.length - 1)), within);
  const cursorIn = lift(frame, timing.sweepFrom - 10, 10);

  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1400 }}>
      {items.map((item, i) => {
        const p = lift(frame, timing.enterFrom + i * timing.enterStep, 14);
        const on = tween(frame, litAt(timing, i), 6);
        const center = centerOf(i);
        const x = center - width / 2 + (960 - center) * REGROUP * regroup;
        const y = (1 - p) * RISE - LIT_LIFT * on + float(frame, i * 9, DRIFT);

        return (
          <div key={item.name} style={{ position: "absolute", left: x, top: 0, width, height, borderRadius: 18, background: style.bg, border: `2px solid ${on > 0.5 ? ORANGE : style.line}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: item.mono ? MONO : UI, color: style.text, opacity: p, transform: `translateY(${y}px) rotateY(${(1 - p) * -FLIP}deg) scale(${(0.75 + 0.25 * p) * (1 - 0.2 * regroup)})` }}>
            <div style={{ transform: `scale(${1 + 0.12 * Math.sin(Math.PI * on)})` }}>{item.icon}</div>
            <div style={{ fontSize: 24, whiteSpace: "nowrap" }}>{item.name}</div>
            <div style={{ position: "absolute", top: 14, right: 14, height: 30, padding: "0 10px", display: "flex", alignItems: "center", gap: 6, background: ORANGE, color: PAPER, fontFamily: MONO, fontSize: 15, transform: `scale(${on})`, transformOrigin: "100% 0" }}>
              <span style={{ width: 8, height: 8, background: PAPER }} />
              {label}
            </div>
          </div>
        );
      })}
      {cursorIn > 0 ? <Pointer x={cursorX + POINTER_OFFSET.x} y={height - POINTER_OFFSET.y + (1 - cursorIn) * 200} pressed={within > 0.85 || frame - litAt(timing, from) < 3} /> : null}
    </div>
  );
};
