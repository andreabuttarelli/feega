import { useCurrentFrame } from "remotion";
import { lift, tween } from "../ease";
import { DISPLAY, TONES, Tone } from "./style";

export enum Align {
  Center = "center",
  Left = "left",
}

const WORD_STAGGER = 2;
const BOX_DELAY = 8;
const BOX_WIPE = 7;
const WORD_TILT = 6;
const BOXED_GROW = 0.06;

export const boxPopAt = (lines: string[], start = 0) => start + lines.join(" ").split(" ").length * WORD_STAGGER + BOX_DELAY;

export const Headline = ({ lines, boxed, tone, size, align, start = 0 }: { lines: string[]; boxed: string; tone: Tone; size: number; align: Align; start?: number }) => {
  const frame = useCurrentFrame();
  const colors = TONES[tone];
  const box = tween(frame, boxPopAt(lines, start), BOX_WIPE);
  const grow = lift(frame, boxPopAt(lines, start), 12);
  let index = 0;

  return (
    <div style={{ fontFamily: DISPLAY, fontSize: size, fontWeight: 560, letterSpacing: "-0.05em", lineHeight: 1.04, color: colors.fg }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", justifyContent: align === Align.Center ? "center" : "flex-start", gap: "0.22em" }}>
          {line.split(" ").map((word, wi) => {
            const p = lift(frame, start + index++ * WORD_STAGGER, 12);
            const isBoxed = word.startsWith(boxed);
            const label = isBoxed ? boxed : word;
            const trail = isBoxed ? word.slice(boxed.length) : "";

            return (
              <span key={wi} style={{ display: "inline-flex", transform: `translateY(${(1 - p) * 0.5}em) rotate(${(1 - p) * WORD_TILT}deg)`, transformOrigin: "0 100%", opacity: p }}>
                <span style={{ position: "relative", padding: isBoxed ? "0 0.06em" : 0, display: "inline-block", transform: isBoxed ? `scale(${1 + BOXED_GROW * grow})` : undefined }}>
                  {isBoxed ? <span style={{ position: "absolute", inset: "0.1em 0 0.02em", background: colors.box, transform: `scaleX(${box})`, transformOrigin: "left center" }} /> : null}
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
