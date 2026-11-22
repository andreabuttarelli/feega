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
import { INK, MONO, ORANGE, Tone } from "../style";

export const EDITORS_FRAMES = 100;
export const EDITORS_TONE = Tone.White;

const GAP_OPEN = 8;
const FIRST_SWAP = 16;
const SWAP_STEP = 11;
const FLIP = 6;
const ICON = 150;
const SLOT = 230;
const FONT = 64;
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

const Terminal = () => (
  <span style={{ width: ICON, height: ICON, borderRadius: 32, background: INK, display: "grid", placeItems: "center", fontFamily: MONO, fontSize: 64, color: ORANGE, letterSpacing: "-0.05em" }}>&gt;_</span>
);

const Logo = ({ tool }: { tool: Tool }) => (tool.mark ? <Mark mark={tool.mark} size={ICON} color={tool.color} /> : <Terminal />);

const current = (frame: number, snap: (f: number) => number) => TOOLS.reduce((top, _, i) => (frame >= snap(swapAt(i)) ? i : top), -1);

const Flip = () => {
  const frame = useCurrentFrame();
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
      <div style={{ width: ICON, height: ICON, transform: `rotateY(${angle}deg) scale(${pop})` }}>
        <Logo tool={shown} />
      </div>
      <span style={{ position: "absolute", top: ICON + 22, fontFamily: MONO, fontSize: 22, letterSpacing: "0", color: "#8a8780", whiteSpace: "nowrap", opacity: label, transform: `translateY(${(1 - label) * 10}px)` }}>{TOOLS[top].name}</span>
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
  const open = glide(frame, GAP_OPEN, 10);

  return <span style={{ position: "relative", display: "inline-flex", justifyContent: "center", alignItems: "flex-start", width: open * SLOT, height: ICON }}>{children}</span>;
};

export const Editors = () => {
  const frame = useCurrentFrame();

  return (
    <Section tone={EDITORS_TONE}>
      <Scatter specks={specks(6, 18, [ORANGE, "#004dff", "#c9c6bd"])} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: FONT, letterSpacing: "-0.03em", color: INK, transform: `translateY(${float(frame, 0, 4)}px)` }}>
        <Words text="feega runs in" from={0} align="right" />
        <Slot>
          <Flip />
        </Slot>
        <Words text="your editor." from={4} align="left" />
      </div>
      <Tumble sprite="code" size={8} y={140} from={30} frames={80} heading={Heading.Right} />
      <Tumble sprite="palette" size={8} y={150} from={38} frames={80} heading={Heading.Right} />
    </Section>
  );
};
