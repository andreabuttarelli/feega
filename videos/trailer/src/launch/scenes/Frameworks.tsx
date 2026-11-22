import { siAstro, siNextdotjs, siNuxt, siReact, siReactrouter, siSvelte, siVite, siVuedotjs } from "simple-icons";
import { Mark } from "../../components/brandIcons";
import { Align, Headline, boxPopAt } from "../Headline";
import { Lineup, type LineupItem, type LineupTiming } from "../Lineup";
import { Heading, Runner } from "../pixel";
import { Place, Section } from "../Section";
import { INK, Tone } from "../style";

export const FRAMEWORKS_FRAMES = 105;
export const FRAMEWORKS_TONE = Tone.Paper;
export const FRAMEWORKS_TIMING: LineupTiming = { enterFrom: 10, enterStep: 2, sweepFrom: 34, sweepStep: 6 };

const LINES = ["every framework."];
const ICONS = [siReact, siNextdotjs, siVuedotjs, siNuxt, siSvelte, siAstro, siReactrouter, siVite];
const DARK_ON_PAPER = new Set([siNextdotjs.slug, siAstro.slug, siReactrouter.slug]);

export const FRAMEWORKS: LineupItem[] = ICONS.map((icon) => ({
  name: icon.title,
  icon: <Mark mark={{ path: icon.path, viewBox: "0 0 24 24" }} size={76} color={DARK_ON_PAPER.has(icon.slug) ? INK : `#${icon.hex}`} />,
}));

export const FRAMEWORKS_BOX = boxPopAt(LINES);

export const Frameworks = () => (
  <Section tone={FRAMEWORKS_TONE} eyebrow="07 · frameworks">
    <Place x={0} y={250} style={{ width: 1920 }}>
      <Headline lines={LINES} boxed="framework" tone={FRAMEWORKS_TONE} size={150} align={Align.Center} />
    </Place>
    <Place x={0} y={560} style={{ width: 1920, height: 220 }}>
      <Lineup items={FRAMEWORKS} tone={FRAMEWORKS_TONE} width={186} height={200} gap={20} timing={FRAMEWORKS_TIMING} label="works" />
    </Place>
    <Runner sprite="cube" size={8} y={900} from={20} frames={70} heading={Heading.Left} />
    <Runner sprite="layers" size={8} y={900} from={27} frames={70} heading={Heading.Left} />
    <Runner sprite="star" size={8} y={900} from={34} frames={70} heading={Heading.Left} />
  </Section>
);
