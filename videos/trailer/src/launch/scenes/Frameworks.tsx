import { siAstro, siNextdotjs, siNuxt, siReact, siReactrouter, siSvelte, siVite, siVuedotjs, type SimpleIcon } from "simple-icons";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Mark } from "../../components/brandIcons";
import { Sound, type Cue } from "../../components/Sfx";
import { glide, lift, mix } from "../../ease";
import { Ground, Landscape } from "../Landscape";
import { float } from "../motion";
import { Scatter, specks } from "../pixel";
import { Section } from "../Section";
import { INK, MONO, ORANGE, PAPER, Tone } from "../style";

export const FRAMEWORKS_FRAMES = 95;
export const FRAMEWORKS_TONE = Tone.White;

const ENTER_FROM = 4;
const ENTER_STEP = 4;
const SUCK = 18;
const STEP = 8;
const CARD = 230;
const CENTER = { x: 960, y: 540 };

type Spot = { icon: SimpleIcon; x: number; y: number; depth: number; tilt: number };

const SPOTS: Spot[] = [
  { icon: siReact, x: 300, y: 250, depth: 1.1, tilt: -8 },
  { icon: siNextdotjs, x: 1540, y: 230, depth: 0.85, tilt: 6 },
  { icon: siVuedotjs, x: 700, y: 170, depth: 0.7, tilt: 4 },
  { icon: siSvelte, x: 1220, y: 820, depth: 1.15, tilt: -5 },
  { icon: siNuxt, x: 1700, y: 650, depth: 0.95, tilt: 9 },
  { icon: siAstro, x: 240, y: 760, depth: 0.9, tilt: 7 },
  { icon: siReactrouter, x: 1260, y: 200, depth: 0.65, tilt: -6 },
  { icon: siVite, x: 680, y: 860, depth: 0.8, tilt: -9 },
];

const enterAt = (i: number) => ENTER_FROM + i * ENTER_STEP;

export const FRAMEWORKS_CUES: Cue[] = SPOTS.map((_, i) => ({ at: enterAt(i), sound: Sound.Pop, volume: 0.4 }));

const Tile = ({ icon, seed }: { icon: SimpleIcon; seed: number }) => (
  <div style={{ position: "relative", padding: STEP }}>
    <div style={{ position: "absolute", inset: `0 ${STEP}px`, background: INK }} />
    <div style={{ position: "absolute", inset: `${STEP}px 0`, background: INK }} />
    <div style={{ position: "relative", width: CARD, height: CARD, overflow: "hidden" }}>
      <Landscape cols={36} rows={36} seed={seed} ground={seed % 2 ? Ground.Lake : Ground.Hills} width={CARD} height={CARD} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 52, background: INK, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", fontFamily: MONO, fontSize: 19, color: PAPER }}>
        <span style={{ width: 10, height: 10, background: `#${icon.hex}` }} />
        {icon.title}
      </div>
      <div style={{ position: "absolute", left: CARD / 2 - 46, top: 44, width: 92, height: 92, background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `6px 6px 0 ${INK}` }}>
        <Mark mark={{ path: icon.path, viewBox: "0 0 24 24" }} size={58} color={`#${icon.hex}`} />
      </div>
    </div>
  </div>
);

export const Frameworks = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const suck = glide(frame, durationInFrames - SUCK - 4, SUCK);
  const text = lift(frame, 2, 12);

  return (
    <Section tone={FRAMEWORKS_TONE}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1 - suck})`, transformOrigin: "50% 50%", opacity: 1 - suck }}>
        <Scatter specks={specks(7, 26, [ORANGE, "#004dff", INK])} />
      </div>
      {SPOTS.map((spot, i) => {
        const p = lift(frame, enterAt(i), 14);
        const outward = { x: spot.x - CENTER.x, y: spot.y - CENTER.y };
        const drift = -frame * 1.4 * spot.depth;
        const x = mix(spot.x + outward.x * 0.9 * (1 - p) + drift, CENTER.x, suck);
        const y = mix(spot.y + outward.y * 0.9 * (1 - p) + float(frame, i * 9, 12 * spot.depth), CENTER.y, suck);
        const rotate = spot.tilt + Math.sin((frame + i * 20) / 40) * 4 + (1 - p) * 30 + suck * 120;
        const scale = spot.depth * (0.5 + 0.5 * p) * (1 - suck);

        return (
          <div key={spot.icon.slug} style={{ position: "absolute", left: x - CARD / 2 - STEP, top: y - CARD / 2 - STEP, zIndex: Math.round(spot.depth * 10), opacity: Math.min(p * 2, 1), transform: `rotate(${rotate}deg) scale(${scale})` }}>
            <Tile icon={spot.icon} seed={i + 3} />
          </div>
        );
      })}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: MONO, fontSize: 46, color: INK, letterSpacing: "-0.02em", opacity: text * (1 - suck), transform: `translateY(${(1 - text) * 20}px) scale(${1 - 0.6 * suck})`, zIndex: 9 }}>
        <span style={{ width: 16, height: 16, background: ORANGE }} />
        every framework.
      </div>
    </Section>
  );
};
