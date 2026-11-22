import { siAstro, siNextdotjs, siNuxt, siReact, siReactrouter, siSvelte, siVite, siVuedotjs } from "simple-icons";
import { useCurrentFrame } from "remotion";
import { tween } from "../../ease";
import { Mark } from "../../components/brandIcons";
import { Align, Headline, boxPopAt } from "../Headline";
import { Place, Section } from "../Section";
import { INK, Tone, UI } from "../style";

export const FRAMEWORKS_FRAMES = 90;
export const LOGOS_FROM = 14;
export const LOGO_STEP = 4;

const LINES = ["every framework."];
const ICONS = [siReact, siNextdotjs, siVuedotjs, siNuxt, siSvelte, siAstro, siReactrouter, siVite];
const DARK_ON_PAPER = new Set([siNextdotjs.slug, siAstro.slug, siReactrouter.slug]);

export const FRAMEWORKS_BOX = boxPopAt(LINES);

export const Frameworks = () => {
  const frame = useCurrentFrame();

  return (
    <Section tone={Tone.Paper} eyebrow="07 · frameworks">
      <Place x={0} y={280} style={{ width: 1920 }}>
        <Headline lines={LINES} boxed="framework" tone={Tone.Paper} size={150} align={Align.Center} />
      </Place>
      <Place x={0} y={600} style={{ width: 1920, display: "flex", justifyContent: "center", gap: 64 }}>
        {ICONS.map((icon, i) => {
          const p = tween(frame, LOGOS_FROM + i * LOGO_STEP, 10);

          return (
            <div key={icon.slug} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, transform: `translateY(${(1 - p) * 60}px) scale(${0.4 + 0.6 * p})`, opacity: p }}>
              <Mark mark={{ path: icon.path, viewBox: "0 0 24 24" }} size={104} color={DARK_ON_PAPER.has(icon.slug) ? INK : `#${icon.hex}`} />
              <span style={{ fontFamily: UI, fontSize: 22, color: "#55534e" }}>{icon.title}</span>
            </div>
          );
        })}
      </Place>
    </Section>
  );
};
