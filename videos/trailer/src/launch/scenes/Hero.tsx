import { AsciiField } from "../AsciiField";
import { Align, Headline } from "../Headline";
import { ICONS, IconRow, Scatter, specks } from "../pixel";
import { Place, Section } from "../Section";
import { BLUE, ORANGE, Tone, WHITE } from "../style";

export const HERO_LINES = ["design in your", "codebase."];
export const HERO_FRAMES = 83;
export const HERO_TONE = Tone.White;

const SPECKS = specks(1, 22, [ORANGE, BLUE, "#ff8a3d"]);

export const Hero = () => (
  <Section tone={HERO_TONE}>
    <AsciiField fade={WHITE} strength={1.6} />
    <Scatter specks={SPECKS} />
    <Place x={0} y={250} style={{ width: 1920 }}>
      <Headline lines={HERO_LINES} boxed="codebase" tone={HERO_TONE} size={150} align={Align.Center} />
    </Place>
    <Place x={0} y={720} style={{ width: 1920, display: "flex", justifyContent: "center" }}>
      <IconRow sprites={ICONS} size={10} start={14} gap={44} stagger={2} />
    </Place>
  </Section>
);
