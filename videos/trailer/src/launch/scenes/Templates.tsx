import { Img, staticFile, useCurrentFrame } from "remotion";
import { glide, mix, tween } from "../../ease";
import { Align, Headline } from "../Headline";
import { float } from "../motion";
import { Pixel, hop } from "../pixel";
import { Pointer, pointerAt } from "../Pointer";
import { Place, Section } from "../Section";
import { ORANGE, Tone, UI } from "../style";

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
const LIBRARY = ["hero", "pricing", "bento grid", "faq", "footer"];
const PICKED = 1;
const ROW_H = 46;

const PixelFrame = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <div style={{ position: "relative", padding: STEP }}>
    <div style={{ position: "absolute", inset: `0 ${STEP}px`, background: color }} />
    <div style={{ position: "absolute", inset: `${STEP}px 0`, background: color }} />
    <div style={{ position: "relative", width: TILE_W, height: TILE_H, overflow: "hidden" }}>{children}</div>
  </div>
);

export const Templates = () => {
  const frame = useCurrentFrame();
  const shift = mix(300, -2400, glide(frame, 0, 92));
  const library = tween(frame, LIBRARY_IN, 16);
  const pointer = pointerAt(frame, [
    { at: LIBRARY_IN + 8, x: 380, y: 420 },
    { at: LIBRARY_CLICK - 2, x: 140, y: 74 + PICKED * ROW_H + 18 },
  ]);
  const picked = frame >= LIBRARY_CLICK;
  const inserted = tween(frame, LIBRARY_CLICK + 4, 10);

  return (
    <Section tone={TEMPLATES_TONE} eyebrow="04 · templates">
      <Place x={0} y={150} style={{ width: 1920 }}>
        <Headline lines={["61 free templates."]} boxed="templates" tone={Tone.Ink} size={130} align={Align.Center} />
      </Place>
      <Place x={0} y={500} style={{ display: "flex", gap: GAP, transform: `translateX(${shift}px)` }}>
        {SHOTS.map((shot, i) => (
          <div key={shot} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, transform: `translateY(${float(frame, i * 13, BOB)}px) rotate(${float(frame, i * 7, 1.2)}deg)` }}>
            <PixelFrame color={FRAME_COLORS[i % FRAME_COLORS.length]}>
              <Img src={staticFile(`templates/${shot}.webp`)} style={{ width: TILE_W, height: TILE_H, objectFit: "cover" }} />
            </PixelFrame>
            <div style={{ transform: `translate(${shift * SPRITE_PARALLAX}px, ${hop(frame, i * 4)}px)` }}>
              <Pixel sprite={i % 2 ? "frame" : "blob"} size={7} />
            </div>
          </div>
        ))}
      </Place>
      <Place x={1220} y={430} style={{ transform: `translateY(${(1 - library) * 700}px) rotate(${(1 - library) * 10}deg)` }}>
        <div style={{ width: 520, borderRadius: 14, background: "#1c1c1b", border: "1px solid #2e2e2c", fontFamily: UI, fontSize: 20, color: "#e9e7e2", padding: "18px 14px", position: "relative", boxShadow: "0 40px 90px rgba(0,0,0,.5)" }}>
          <div style={{ fontSize: 14, letterSpacing: "0.08em", color: "#8a8780", padding: "0 10px 12px" }}>LIBRARY</div>
          {LIBRARY.map((item, i) => (
            <div key={item} style={{ height: ROW_H, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderRadius: 8, background: picked && i === PICKED ? ORANGE : "transparent" }}>
              {item}
              {picked && i === PICKED ? <span style={{ fontSize: 15, opacity: inserted }}>inserted</span> : <span style={{ color: "#8a8780", fontSize: 15 }}>insert</span>}
            </div>
          ))}
          {frame >= LIBRARY_IN + 8 ? <Pointer x={pointer.x} y={pointer.y} pressed={Math.abs(frame - LIBRARY_CLICK) < 3} /> : null}
        </div>
      </Place>
    </Section>
  );
};
