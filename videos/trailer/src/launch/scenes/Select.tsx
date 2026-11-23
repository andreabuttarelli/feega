import { useCurrentFrame } from "remotion";
import { tween } from "../../ease";
import { EDITOR_REST, FeegaEditor, SWATCHES, pressAmount } from "../editor/FeegaEditor";
import { BASE_FONT, COLOUR_FIELD, center, h1Rect, swatchRect } from "../editor/layout";
import { Align, Headline } from "../Headline";
import { Pointer, pointerAt, type Click } from "../Pointer";
import { Place, Section } from "../Section";
import { Format, rectOnScreen, useStage, type Camera, type TallClick } from "../stage";
import { Tone } from "../style";

export const SELECT_FRAMES = 83;
export const SELECT_TONE = Tone.Orange;
export const SELECT_CLICK = 30;
export const COLOUR_CLICK = 46;
export const SWATCH_CLICK = 60;

const RISE = 520;
const FOCUS = { x: 860, y: 330 };
const ZOOM_FROM = 16;
const ZOOM_SPAN = 40;

const LAYOUT = {
  [Format.Wide]: { appAt: { x: 140, y: 230 }, scale: 1.28, push: 0.06, pointer: 1.6, title: { lines: ["edit your running app visually."], size: 96, y: 62 }, view: null },
  [Format.Tall]: { appAt: { x: -352, y: 778 }, scale: 1.1, push: 0.04, pointer: 2.2, title: { lines: ["edit your", "running app", "visually."], size: 150, y: 280 }, view: { x: 0, y: 800, w: 1080, h: 780 } },
};

const zoomAt = (frame: number, push: number) => 1 + push * tween(frame, ZOOM_FROM, ZOOM_SPAN);
const H1 = h1Rect(BASE_FONT);
const ORANGE_SWATCH = swatchRect(1);

const PATH = [
  { at: 12, x: 760, y: 680 },
  { at: SELECT_CLICK - 4, x: H1.x + 180, y: H1.y + 50 },
  { at: COLOUR_CLICK - 4, ...center(COLOUR_FIELD) },
  { at: SWATCH_CLICK - 4, ...center(ORANGE_SWATCH) },
];

export const SELECT_CLICKS: Click[] = [
  { label: "select h1", at: SELECT_CLICK, path: PATH, rect: H1 },
  { label: "open fill", at: COLOUR_CLICK, path: PATH, rect: COLOUR_FIELD },
  { label: "pick orange", at: SWATCH_CLICK, path: PATH, rect: ORANGE_SWATCH },
];

const TALL = LAYOUT[Format.Tall];

const tallCamera = (at: number): Camera => {
  const zoom = zoomAt(at, TALL.push);

  return { x: TALL.appAt.x + TALL.scale * FOCUS.x * (1 - zoom), y: TALL.appAt.y + TALL.scale * FOCUS.y * (1 - zoom), scale: TALL.scale * zoom };
};

export const SELECT_TALL_CLICKS: TallClick[] = SELECT_CLICKS.map((c) => ({ label: c.label, at: c.at, target: rectOnScreen(c.rect, tallCamera(c.at)), view: TALL.view! }));

const isPressed = (frame: number) => SELECT_CLICKS.some((c) => Math.abs(frame - c.at) < 3);

export const Select = () => {
  const frame = useCurrentFrame();
  const { width, format } = useStage();
  const L = LAYOUT[format];
  const enter = tween(frame, 0, 16);
  const zoom = zoomAt(frame, L.push);
  const pointer = pointerAt(frame, PATH);
  const state = {
    ...EDITOR_REST,
    hover: tween(frame, SELECT_CLICK - 8, 5),
    selected: tween(frame, SELECT_CLICK, 4),
    swatches: tween(frame, COLOUR_CLICK, 6) - tween(frame, SWATCH_CLICK + 8, 6),
    headColor: frame >= SWATCH_CLICK ? SWATCHES[1] : SWATCHES[0],
    saved: tween(frame, SWATCH_CLICK + 4, 6),
    presses: [
      { rect: H1, amount: pressAmount(frame, SELECT_CLICK) },
      { rect: COLOUR_FIELD, amount: pressAmount(frame, COLOUR_CLICK) },
      { rect: ORANGE_SWATCH, amount: pressAmount(frame, SWATCH_CLICK) },
    ],
  };
  const scale = L.scale * zoom;
  const view = L.view ?? { x: 0, y: 0, w: width, h: 0 };
  const clip = L.view ? { width: view.w, height: view.h, overflow: "hidden" as const } : undefined;
  const appAt = { x: L.appAt.x - view.x, y: L.appAt.y - view.y };

  return (
    <Section tone={SELECT_TONE}>
      <Place x={0} y={L.title.y} style={{ width }}>
        <Headline lines={L.title.lines} boxed="visually" tone={SELECT_TONE} size={L.title.size} align={Align.Center} />
      </Place>
      <Place x={view.x} y={view.y} style={clip}>
      <Place x={appAt.x} y={appAt.y} style={{ transform: `translateY(${(1 - enter) * RISE}px)` }}>
        <div style={{ transform: `scale(${L.scale})`, transformOrigin: "0 0" }}>
          <div style={{ position: "relative", transform: `scale(${zoom})`, transformOrigin: `${FOCUS.x}px ${FOCUS.y}px` }}>
            <FeegaEditor state={state} />
            {frame >= PATH[0].at ? <Pointer x={pointer.x} y={pointer.y} pressed={isPressed(frame)} scale={scale / L.pointer} /> : null}
          </div>
        </div>
      </Place>
      </Place>
    </Section>
  );
};
