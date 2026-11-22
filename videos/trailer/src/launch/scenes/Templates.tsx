import { Img, staticFile, useCurrentFrame } from "remotion";
import { glide, mix } from "../../ease";
import { AsciiField } from "../AsciiField";
import { Landscape } from "../Landscape";
import { Align, Headline } from "../Headline";
import { float } from "../motion";
import { ICONS, Pixel, hop } from "../pixel";
import { Place, Section } from "../Section";
import { INK, ORANGE, Tone } from "../style";

export const TEMPLATES_FRAMES = 72;
export const TEMPLATES_TONE = Tone.Ink;

const SPRITE_PARALLAX = 0.18;
const BOB = 14;

const SHOTS = [
  "pricing-light",
  "bento-grid-dark",
  "card-light",
  "command-palette-dark",
  "comparison-table-light",
  "data-table-dark",
  "changelog-light",
  "dropdown-menu-dark",
  "contact-form-light",
  "faq-dark",
  "features-grid-light",
  "blog-cards-light",
];

const TILE_W = 480;
const TILE_H = 300;
const GAP = 48;
const STEP = 8;
const FRAME_COLORS = [ORANGE, "#004dff", "#f0eee9"];
const BACKDROP = 36;

const PixelFrame = ({ color, seed, children }: { color: string; seed: number; children: React.ReactNode }) => (
  <div style={{ position: "relative", padding: STEP + BACKDROP }}>
    <div style={{ position: "absolute", inset: 0 }}>
      <Landscape cols={69} rows={46} seed={seed} width={TILE_W + 2 * (STEP + BACKDROP)} height={TILE_H + 2 * (STEP + BACKDROP)} />
    </div>
    <div style={{ position: "absolute", inset: BACKDROP, padding: STEP }}>
      <div style={{ position: "absolute", inset: `0 ${STEP}px`, background: color }} />
      <div style={{ position: "absolute", inset: `${STEP}px 0`, background: color }} />
    </div>
    <div style={{ position: "relative", width: TILE_W, height: TILE_H, overflow: "hidden" }}>{children}</div>
  </div>
);

export const Templates = () => {
  const frame = useCurrentFrame();
  const shift = mix(300, -2400, glide(frame, 0, TEMPLATES_FRAMES + 20));

  return (
    <Section tone={TEMPLATES_TONE}>
      <AsciiField fade={INK} strength={0.7} />
      <Place x={0} y={150} style={{ width: 1920 }}>
        <Headline lines={["free and premium templates."]} boxed="templates" tone={Tone.Ink} size={120} align={Align.Center} />
      </Place>
      <Place x={0} y={500} style={{ display: "flex", gap: GAP, transform: `translateX(${shift}px)` }}>
        {SHOTS.map((shot, i) => (
          <div key={shot} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, transform: `translateY(${float(frame, i * 13, BOB)}px) rotate(${float(frame, i * 7, 1.2)}deg)` }}>
            <PixelFrame color={FRAME_COLORS[i % FRAME_COLORS.length]} seed={i + 11}>
              <Img src={staticFile(`templates/${shot}.webp`)} style={{ width: TILE_W, height: TILE_H, objectFit: "cover" }} />
            </PixelFrame>
            <div style={{ transform: `translate(${shift * SPRITE_PARALLAX}px, ${hop(frame, i * 4)}px)` }}>
              <Pixel sprite={ICONS[i % ICONS.length]} size={7} />
            </div>
          </div>
        ))}
      </Place>
    </Section>
  );
};
