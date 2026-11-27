import { AsciiField } from "../AsciiField";
import { Align, Headline } from "../Headline";
import { ICONS, IconRow, Scatter, specks } from "../pixel";
import { Place, Section } from "../Section";
import { Format, TALL_STAGE, useStage } from "../stage";
import { BLUE, ORANGE, Tone, WHITE } from "../style";

export const HERO_LINES = ["design in your", "codebase."];
export const HERO_FRAMES = 83;
export const HERO_TONE = Tone.White;

const WIDE_AREA = { width: 1920, height: 1080 };

const LAYOUT = {
  [Format.Wide]: { lines: HERO_LINES, size: 150, titleY: 250, iconsY: 720, iconSize: 10, iconGap: 44, area: WIDE_AREA },
  [Format.Tall]: { lines: ["design", "in your", "codebase."], size: 180, titleY: 560, iconsY: 1230, iconSize: 7, iconGap: 24, area: TALL_STAGE },
};

const COLORS = [ORANGE, BLUE, "#ff8a3d"];

export const Hero = () => {
  const { width, format } = useStage();
  const L = LAYOUT[format];

  return (
    <Section tone={HERO_TONE}>
      <AsciiField fade={WHITE} strength={1.6} />
      <Scatter specks={specks(1, 22, COLORS, L.area)} />
      <Place x={0} y={L.titleY} style={{ width }}>
        <Headline lines={L.lines} boxed="codebase" tone={HERO_TONE} size={L.size} align={Align.Center} />
      </Place>
      <Place x={0} y={L.iconsY} style={{ width, display: "flex", justifyContent: "center" }}>
        <IconRow sprites={ICONS} size={L.iconSize} start={14} gap={L.iconGap} stagger={2} />
      </Place>
    </Section>
  );
};
