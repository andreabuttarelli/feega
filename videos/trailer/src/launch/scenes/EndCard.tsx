import { AsciiField } from "../AsciiField";
import { useCurrentFrame } from "remotion";
import { lift, tween } from "../../ease";
import { FeegaMark } from "../../components/brandIcons";
import { float } from "../motion";
import { Heading, Pixel, Tumble, type Sprite } from "../pixel";
import { Ending, Place, Section } from "../Section";
import { Format, useStage } from "../stage";
import { DISPLAY, INK, MONO, ORANGE, PAPER, Tone } from "../style";

export const END_FRAMES = 152;
export const END_TONE = Tone.Ink;

const RUN_IN = 18;
export const LOGO_AT = 4;

const AROUND: { x: number; y: number; s: Sprite }[] = [
  { x: 260, y: 180, s: "palette" },
  { x: 1560, y: 160, s: "code" },
  { x: 180, y: 520, s: "brush" },
  { x: 1680, y: 520, s: "layers" },
  { x: 300, y: 830, s: "frame" },
  { x: 1520, y: 840, s: "terminal" },
  { x: 900, y: 900, s: "cursor" },
  { x: 640, y: 120, s: "star" },
  { x: 1200, y: 110, s: "plug" },
];

const TALL_AROUND: { x: number; y: number; s: Sprite }[] = [
  { x: 120, y: 330, s: "palette" },
  { x: 820, y: 300, s: "code" },
  { x: 90, y: 640, s: "brush" },
  { x: 880, y: 660, s: "layers" },
  { x: 130, y: 1300, s: "frame" },
  { x: 830, y: 1330, s: "terminal" },
  { x: 480, y: 1540, s: "cursor" },
  { x: 330, y: 290, s: "star" },
  { x: 620, y: 300, s: "plug" },
];

const LAYOUT = {
  [Format.Wide]: { around: AROUND, logoY: 330, logo: 150, word: 190, tag: 64, tumbleY: 980 },
  [Format.Tall]: { around: TALL_AROUND, logoY: 780, logo: 150, word: 190, tag: 60, tumbleY: 1560 },
};

export const EndCard = () => {
  const frame = useCurrentFrame();
  const { width, format } = useStage();
  const L = LAYOUT[format];
  const logo = tween(frame, LOGO_AT, 16);
  const tag = lift(frame, 18, 14);
  const chip = tween(frame, 28, 12);

  return (
    <Section tone={END_TONE} ending={Ending.Hold}>
      <AsciiField fade={INK} />
      {L.around.map((a, i) => {
        const p = tween(frame, 6 + i * 3, RUN_IN);
        const offstage = a.x < width / 2 ? -a.x - 200 : width + 200 - a.x;

        return (
          <Place key={i} x={a.x} y={a.y} style={{ transform: `translate(${(1 - p) * offstage}px, ${float(frame, i * 7, 10)}px) rotate(${(1 - p) * (a.x < width / 2 ? 14 : -14) + float(frame, i * 11, 6)}deg)` }}>
            <Pixel sprite={a.s} size={11} />
          </Place>
        );
      })}
      <Place x={0} y={L.logoY} style={{ width, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30, transform: `scale(${0.7 + 0.3 * logo})`, opacity: logo }}>
          <FeegaMark size={L.logo} />
          <span style={{ fontFamily: DISPLAY, fontSize: L.word, fontWeight: 560, letterSpacing: "-0.05em", color: PAPER, lineHeight: 1 }}>feega</span>
        </div>
        <div style={{ marginTop: 40, fontFamily: DISPLAY, fontSize: L.tag, fontWeight: 500, letterSpacing: "-0.04em", color: PAPER, opacity: tag, transform: `translateY(${(1 - tag) * 30}px)` }}>design in your codebase.</div>
        <div style={{ marginTop: 44, display: "flex", alignItems: "center", gap: 14, padding: "14px 26px", background: ORANGE, color: PAPER, fontFamily: MONO, fontSize: 30, transform: `scale(${chip})` }}>
          <span style={{ width: 12, height: 12, background: PAPER }} />
          feega.app
        </div>
      </Place>
      <Tumble sprite="code" size={9} y={L.tumbleY} from={60} frames={60} heading={Heading.Right} />
      <Tumble sprite="palette" size={9} y={L.tumbleY} from={68} frames={60} heading={Heading.Right} />
    </Section>
  );
};
