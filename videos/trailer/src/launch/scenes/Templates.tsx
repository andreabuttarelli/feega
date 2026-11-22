import { Img, staticFile, useCurrentFrame } from "remotion";
import { glide, mix, tween } from "../../ease";
import { AsciiField } from "../AsciiField";
import { Landscape } from "../Landscape";
import { Align, Headline } from "../Headline";
import { float } from "../motion";
import { ICONS, Pixel, hop } from "../pixel";
import { APP_REST, AppShot, LeftTab, TEMPLATES, pressAmount } from "../app/AppShot";
import { DROP, cardRect } from "../app/appLayout";
import { center, type Rect } from "../editor/layout";
import { Pointer, pointerAt, type Click } from "../Pointer";
import { Place, Section } from "../Section";
import { INK, ORANGE, Tone } from "../style";

export const TEMPLATES_FRAMES = 116;
export const TEMPLATES_TONE = Tone.Ink;
export const LIBRARY_IN = 58;
export const LIBRARY_CLICK = 76;

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
const PICKED_RECT = cardRect(PICKED);
const CLOSE = { x: 90, y: -110, scale: 1.7 };
const PUSH = 0.05;
const FLY_FRAMES = 12;
const PATH = [
  { at: LIBRARY_IN + 4, x: 560, y: 760 },
  { at: LIBRARY_CLICK - 4, ...center(PICKED_RECT) },
];

export const TEMPLATES_CLICKS: Click[] = [{ label: "insert pricing", at: LIBRARY_CLICK, path: PATH, rect: PICKED_RECT }];

const between = (a: Rect, b: Rect, t: number): Rect => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) });

const Ghost = ({ t }: { t: number }) => {
  const r = between({ ...PICKED_RECT, h: PICKED_RECT.h - 34 }, DROP, t);

  return (
    <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: 18, overflow: "hidden", opacity: t < 1 ? 1 : 0, boxShadow: "0 30px 60px rgba(0,0,0,.4)", transform: `rotate(${Math.sin(Math.PI * t) * -4}deg)` }}>
      <Img src={staticFile(`templates/${TEMPLATES[PICKED].src}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
};

const CloseUp = ({ frame }: { frame: number }) => {
  const pointer = pointerAt(frame, PATH);
  const fly = tween(frame, LIBRARY_CLICK + 2, FLY_FRAMES);
  const zoom = 1 + PUSH * tween(frame, LIBRARY_IN, 50);
  const state = {
    ...APP_REST,
    left: LeftTab.Library,
    pick: frame >= LIBRARY_CLICK ? PICKED : -1,
    inserted: tween(frame, LIBRARY_CLICK + FLY_FRAMES - 2, 10),
    presses: [{ rect: PICKED_RECT, amount: pressAmount(frame, LIBRARY_CLICK) }],
  };

  return (
    <Place x={CLOSE.x} y={CLOSE.y} style={{ transform: `scale(${CLOSE.scale * zoom})`, transformOrigin: "0 0" }}>
      <AppShot state={state} />
      {fly > 0 ? <Ghost t={fly} /> : null}
      {frame >= PATH[0].at ? <Pointer x={pointer.x} y={pointer.y} pressed={Math.abs(frame - LIBRARY_CLICK) < 3} scale={CLOSE.scale * zoom} /> : null}
    </Place>
  );
};

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
  const shift = mix(300, -2400, glide(frame, 0, LIBRARY_IN + 20));

  if (frame >= LIBRARY_IN) {
    return (
      <Section tone={TEMPLATES_TONE}>
        <CloseUp frame={frame} />
      </Section>
    );
  }

  return (
    <Section tone={TEMPLATES_TONE} eyebrow="03 · templates">
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
