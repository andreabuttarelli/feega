import { Img, staticFile, useCurrentFrame } from "remotion";
import { glide, mix, tween } from "../../ease";
import { AsciiField } from "../AsciiField";
import { Landscape } from "../Landscape";
import { Align, Headline } from "../Headline";
import { float } from "../motion";
import { ICONS, Pixel, hop } from "../pixel";
import { EditorFrame } from "../editor/EditorFrame";
import { EDITOR_REST, FeegaEditor, pressAmount } from "../editor/FeegaEditor";
import { Tab, center, libraryRect } from "../editor/layout";
import { Pointer, pointerAt, type Click } from "../Pointer";
import { Place, Section } from "../Section";
import { INK, ORANGE, Tone } from "../style";

export const TEMPLATES_FRAMES = 120;
export const TEMPLATES_TONE = Tone.Ink;
export const LIBRARY_CLICK = 98;
export const LIBRARY_IN = 64;

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
const PICKED = 0;
const PICKED_RECT = libraryRect(PICKED);
const EDITOR = { x: 1000, y: 330, scale: 0.66 };
const PATH = [
  { at: LIBRARY_IN + 8, x: 600, y: 560 },
  { at: LIBRARY_CLICK - 6, ...center(PICKED_RECT) },
];

export const TEMPLATES_CLICKS: Click[] = [{ label: "insert pricing", at: LIBRARY_CLICK, path: PATH, rect: PICKED_RECT }];

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
  const shift = mix(300, -2400, glide(frame, 0, 92));
  const library = tween(frame, LIBRARY_IN, 16);
  const pointer = pointerAt(frame, PATH);
  const inserted = tween(frame, LIBRARY_CLICK + 4, 12);
  const zoom = 1 + 0.24 * tween(frame, 74, 18) - 0.24 * tween(frame, LIBRARY_CLICK + 6, 14);

  return (
    <Section tone={TEMPLATES_TONE} eyebrow="04 · templates">
      <AsciiField fade={INK} strength={0.7} />
      <Place x={0} y={150} style={{ width: 1920 }}>
        <Headline lines={["61 free templates."]} boxed="templates" tone={Tone.Ink} size={130} align={Align.Center} />
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
      <EditorFrame x={EDITOR.x} y={EDITOR.y} scale={EDITOR.scale} enter={library} zoom={zoom} focus={center(PICKED_RECT)}>
        <FeegaEditor state={{ ...EDITOR_REST, tab: Tab.Library, library: { pick: PICKED, inserted }, presses: [{ rect: PICKED_RECT, amount: pressAmount(frame, LIBRARY_CLICK) }] }} />
        {frame >= LIBRARY_IN + 8 ? <Pointer x={pointer.x} y={pointer.y} pressed={Math.abs(frame - LIBRARY_CLICK) < 3} scale={EDITOR.scale * zoom} /> : null}
      </EditorFrame>
    </Section>
  );
};
