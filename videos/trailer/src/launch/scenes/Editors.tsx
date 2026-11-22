import { siVscodium, siWindsurf } from "simple-icons";
import { MARKS, Mark } from "../../components/brandIcons";
import { Align, Headline } from "../Headline";
import { Lineup, type LineupItem, type LineupTiming } from "../Lineup";
import { Heading, Runner } from "../pixel";
import { Place, Section } from "../Section";
import { MONO, ORANGE, PAPER, Tone } from "../style";

export const EDITORS_FRAMES = 120;
export const EDITORS_TONE = Tone.Ink;
export const EDITORS_TIMING: LineupTiming = { enterFrom: 14, enterStep: 3, sweepFrom: 40, sweepStep: 10 };

const BOX = "0 0 24 24";
const ICON = 72;

export const EDITORS: LineupItem[] = [
  { name: "VS Code", icon: <Mark mark={MARKS.vscode} size={ICON} color="#2f9cf4" /> },
  { name: "Cursor", icon: <Mark mark={MARKS.cursor} size={ICON} color={PAPER} /> },
  { name: "Windsurf", icon: <Mark mark={{ path: siWindsurf.path, viewBox: BOX }} size={ICON} color={PAPER} /> },
  { name: "VSCodium", icon: <Mark mark={{ path: siVscodium.path, viewBox: BOX }} size={ICON} color="#2f80ed" /> },
  { name: "npx feega", mono: true, icon: <div style={{ fontFamily: MONO, fontSize: 54, color: ORANGE, height: ICON, lineHeight: `${ICON}px` }}>&gt;_</div> },
];

export const Editors = () => (
  <Section tone={EDITORS_TONE} eyebrow="06 · editors">
    <Place x={0} y={180} style={{ width: 1920 }}>
      <Headline lines={["works where you", "already code."]} boxed="already" tone={EDITORS_TONE} size={124} align={Align.Center} />
    </Place>
    <Place x={0} y={590} style={{ width: 1920, height: 240 }}>
      <Lineup items={EDITORS} tone={EDITORS_TONE} width={300} height={220} gap={28} timing={EDITORS_TIMING} label="connected" />
    </Place>
    <Runner sprite="ghost" size={8} y={930} from={30} frames={80} heading={Heading.Right} />
    <Runner sprite="blob" size={8} y={930} from={38} frames={80} heading={Heading.Right} />
  </Section>
);
