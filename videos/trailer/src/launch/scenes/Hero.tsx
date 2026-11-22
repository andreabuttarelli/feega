import { Align, Headline } from "../Headline";
import { CREW, Parade, Scatter, specks } from "../pixel";
import { Place, Section } from "../Section";
import { BLUE, ORANGE, Tone } from "../style";

export const HERO_LINES = ["the best free", "Lovable alternative."];
export const HERO_FRAMES = 90;
export const HERO_TONE = Tone.Paper;

const SPECKS = specks(1, 22, [ORANGE, BLUE, "#ff8a3d"]);

export const Hero = () => (
  <Section tone={HERO_TONE}>
    <Scatter specks={SPECKS} />
    <Place x={0} y={250} style={{ width: 1920 }}>
      <Headline lines={HERO_LINES} boxed="free" tone={Tone.Paper} size={150} align={Align.Center} />
    </Place>
    <Place x={0} y={720} style={{ width: 1920, display: "flex", justifyContent: "center" }}>
      <Parade sprites={CREW} size={10} start={14} gap={44} stagger={2} />
    </Place>
  </Section>
);
