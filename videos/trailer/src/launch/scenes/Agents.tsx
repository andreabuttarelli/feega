import { siClaude, siCursor, siGooglegemini } from "simple-icons";
import { Mark } from "../../components/brandIcons";
import { Align, Headline } from "../Headline";
import { Lineup, type LineupItem, type LineupTiming } from "../Lineup";
import { CREW, Parade } from "../pixel";
import { Place, Section } from "../Section";
import { DISPLAY, PAPER, Tone } from "../style";

export const AGENTS_FRAMES = 90;
export const AGENTS_TONE = Tone.Ink;
export const AGENTS_LINES = ["works with", "your agent."];
export const AGENTS_TIMING: LineupTiming = { enterFrom: 12, enterStep: 3, sweepFrom: 34, sweepStep: 9 };

const ICON = 72;
const BOX = "0 0 24 24";

const AGENTS: LineupItem[] = [
  { name: "Claude Code", icon: <Mark mark={{ path: siClaude.path, viewBox: BOX }} size={ICON} color={`#${siClaude.hex}`} /> },
  { name: "Codex", icon: <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 56, letterSpacing: "-0.05em", color: PAPER, height: ICON, lineHeight: `${ICON}px` }}>codex</div> },
  { name: "Cursor", icon: <Mark mark={{ path: siCursor.path, viewBox: BOX }} size={ICON} color={PAPER} /> },
  { name: "Gemini CLI", icon: <Mark mark={{ path: siGooglegemini.path, viewBox: BOX }} size={ICON} color={`#${siGooglegemini.hex}`} /> },
];

export const Agents = () => (
  <Section tone={AGENTS_TONE} eyebrow="08 · agents">
    <Place x={0} y={180} style={{ width: 1920 }}>
      <Headline lines={AGENTS_LINES} boxed="agent" tone={AGENTS_TONE} size={124} align={Align.Center} />
    </Place>
    <Place x={0} y={590} style={{ width: 1920, height: 240 }}>
      <Lineup items={AGENTS} tone={AGENTS_TONE} width={320} height={220} gap={32} timing={AGENTS_TIMING} label="connected" />
    </Place>
    <Place x={0} y={900} style={{ width: 1920, display: "flex", justifyContent: "center" }}>
      <Parade sprites={CREW.slice(0, 7)} size={7} start={40} gap={36} stagger={3} />
    </Place>
  </Section>
);
