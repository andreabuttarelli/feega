import { useCurrentFrame } from "remotion";
import { tween } from "../../ease";
import { EDITOR_REST, FeegaEditor, SWATCHES, pressAmount } from "../editor/FeegaEditor";
import { BASE_FONT, COLOUR_FIELD, center, h1Rect, swatchRect } from "../editor/layout";
import { Align, Headline } from "../Headline";
import { Pointer, pointerAt, type Click } from "../Pointer";
import { Place, Section } from "../Section";
import { Tone } from "../style";

export const SELECT_FRAMES = 83;
export const SELECT_TONE = Tone.Orange;
export const SELECT_CLICK = 30;
export const COLOUR_CLICK = 46;
export const SWATCH_CLICK = 60;

const APP_AT = { x: 140, y: 230 };
const EDITOR_SCALE = 1.28;
const RISE = 520;
const PUSH = 0.06;
const FOCUS = { x: 860, y: 330 };
const POINTER_SIZE = 1.6;
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

const isPressed = (frame: number) => SELECT_CLICKS.some((c) => Math.abs(frame - c.at) < 3);

export const Select = () => {
  const frame = useCurrentFrame();
  const enter = tween(frame, 0, 16);
  const zoom = 1 + PUSH * tween(frame, 16, 40);
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
  const scale = EDITOR_SCALE * zoom;

  return (
    <Section tone={SELECT_TONE}>
      <Place x={0} y={62} style={{ width: 1920 }}>
        <Headline lines={["edit your running app visually."]} boxed="visually" tone={SELECT_TONE} size={96} align={Align.Center} />
      </Place>
      <Place x={APP_AT.x} y={APP_AT.y} style={{ transform: `translateY(${(1 - enter) * RISE}px)` }}>
        <div style={{ transform: `scale(${EDITOR_SCALE})`, transformOrigin: "0 0" }}>
          <div style={{ position: "relative", transform: `scale(${zoom})`, transformOrigin: `${FOCUS.x}px ${FOCUS.y}px` }}>
            <FeegaEditor state={state} />
            {frame >= PATH[0].at ? <Pointer x={pointer.x} y={pointer.y} pressed={isPressed(frame)} scale={scale / POINTER_SIZE} /> : null}
          </div>
        </div>
      </Place>
    </Section>
  );
};
