import type { ReactNode } from "react";
import { siVscodium, siWindsurf } from "simple-icons";
import { useCurrentFrame } from "remotion";
import { MARKS, Mark, type BrandMark } from "../../components/brandIcons";
import { Sound, type Cue } from "../../components/Sfx";
import { glide, lift, tween } from "../../ease";
import { useOnBeat } from "../beat";
import { float } from "../motion";
import { Heading, Tumble, Scatter, specks } from "../pixel";
import { Section } from "../Section";
import { Format, TALL_STAGE, useStage } from "../stage";
import { INK, MONO, ORANGE, Tone } from "../style";

export const EDITORS_FRAMES = 97;
export const EDITORS_TONE = Tone.White;

const GAP_OPEN = 8;
const FIRST_SWAP = 16;
const SWAP_STEP = 11;
const FLIP = 6;
const LABEL_GAP = 22;

const LAYOUT = {
  [Format.Wide]: { icon: 150, slot: 230, font: 64, label: 22, flow: "row" as const, tumbleY: [140, 150], area: { width: 1920, height: 1080 } },
  [Format.Tall]: { icon: 230, slot: 330, font: 92, label: 30, flow: "column" as const, tumbleY: [1470, 1500], area: TALL_STAGE },
};

const useLayout = () => LAYOUT[useStage().format];
const BOX = "0 0 24 24";

type Tool = { name: string; mark?: BrandMark; color: string };

const TOOLS: Tool[] = [
  { name: "VS Code", mark: MARKS.vscode, color: "#007acc" },
  { name: "Cursor", mark: MARKS.cursor, color: INK },
  { name: "Windsurf", mark: { path: siWindsurf.path, viewBox: BOX }, color: "#0b9c84" },
  { name: "VSCodium", mark: { path: siVscodium.path, viewBox: BOX }, color: "#2f80ed" },
  { name: "npx feega", color: ORANGE },
];

export const swapAt = (i: number) => FIRST_SWAP + i * SWAP_STEP;

export const EDITORS_CUES: Cue[] = TOOLS.map((_, i) => ({ at: swapAt(i), sound: Sound.ClickA, volume: 0.55, beat: true }));

const Terminal = () => {
  const { icon } = useLayout();

  return <span style={{ width: icon, height: icon, borderRadius: 32, background: INK, display: "grid", placeItems: "center", fontFamily: MONO, fontSize: icon * 0.43, color: ORANGE, letterSpacing: "-0.05em" }}>&gt;_</span>;
};

const Logo = ({ tool }: { tool: Tool }) => {
  const { icon } = useLayout();

  return tool.mark ? <Mark mark={tool.mark} size={icon} color={tool.color} /> : <Terminal />;
};

const current = (frame: number, snap: (f: number) => number) => TOOLS.reduce((top, _, i) => (frame >= snap(swapAt(i)) ? i : top), -1);

const Flip = () => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const snap = useOnBeat();
  const top = current(frame, snap);

  if (top < 0) {
    return null;
  }

  const at = snap(swapAt(top));
  const turn = tween(frame, at, FLIP);
  const leaving = top > 0 && frame < at + FLIP / 2 ? TOOLS[top - 1] : null;
  const shown = leaving ?? TOOLS[top];
  const angle = leaving ? turn * 180 : (1 - turn) * -90;
  const pop = 1 + 0.18 * Math.sin(Math.PI * Math.min(1, (frame - at) / (FLIP + 4)));
  const label = lift(frame, at, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, perspective: 800 }}>
      <div style={{ width: L.icon, height: L.icon, transform: `rotateY(${angle}deg) scale(${pop})` }}>
        <Logo tool={shown} />
      </div>
      <span style={{ position: "absolute", top: L.icon + LABEL_GAP, fontFamily: MONO, fontSize: L.label, letterSpacing: "0", color: "#8a8780", whiteSpace: "nowrap", opacity: label, transform: `translateY(${(1 - label) * 10}px)` }}>{TOOLS[top].name}</span>
    </div>
  );
};

const Words = ({ text, from, align }: { text: string; from: number; align: "left" | "right" }) => {
  const frame = useCurrentFrame();
  const p = lift(frame, from, 12);

  return <span style={{ display: "inline-block", whiteSpace: "nowrap", textAlign: align, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>{text}</span>;
};

const Slot = ({ children }: { children: ReactNode }) => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const open = glide(frame, GAP_OPEN, 10);
  const size = L.flow === "row" ? { width: open * L.slot, height: L.icon } : { width: L.icon, height: open * L.slot };

  return <span style={{ position: "relative", display: "inline-flex", justifyContent: "center", alignItems: "flex-start", ...size }}>{children}</span>;
};

export const Editors = () => {
  const frame = useCurrentFrame();
  const L = useLayout();

  return (
    <Section tone={EDITORS_TONE}>
      <Scatter specks={specks(6, 18, [ORANGE, "#004dff", "#c9c6bd"], L.area)} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: L.flow, alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: L.font, letterSpacing: "-0.03em", color: INK, transform: `translateY(${float(frame, 0, 4)}px)` }}>
        <Words text="feega runs in" from={0} align="right" />
        <Slot>
          <Flip />
        </Slot>
        <Words text="your editor." from={4} align="left" />
      </div>
      <Tumble sprite="code" size={8} y={L.tumbleY[0]} from={30} frames={80} heading={Heading.Right} />
      <Tumble sprite="palette" size={8} y={L.tumbleY[1]} from={38} frames={80} heading={Heading.Right} />
    </Section>
  );
};
