import { useCurrentFrame } from "remotion";
import { tween } from "../../ease";
import { APP_REST, AppShot, SWATCHES, pressAmount } from "../app/AppShot";
import { HEAD, swatchRect } from "../app/appLayout";
import { center } from "../editor/layout";
import { Align, Headline } from "../Headline";
import { Pointer, pointerAt, type Click } from "../Pointer";
import { Place, Section } from "../Section";
import { Tone } from "../style";

export const SELECT_FRAMES = 78;
export const SELECT_TONE = Tone.Orange;
export const SELECT_CLICK = 32;
export const SWATCH_CLICK = 50;

const APP_AT = { x: 140, y: 230 };
const ORANGE_SWATCH = swatchRect(1);
const RISE = 520;
const PUSH = 0.06;
const FOCUS = { x: 1100, y: 420 };
const POINTER_SIZE = 0.62;

const PATH = [
  { at: 14, x: 980, y: 860 },
  { at: SELECT_CLICK - 4, x: HEAD.x + 220, y: HEAD.y + 60 },
  { at: SWATCH_CLICK - 4, ...center(ORANGE_SWATCH) },
];

export const SELECT_CLICKS: Click[] = [
  { label: "select h1", at: SELECT_CLICK, path: PATH, rect: HEAD },
  { label: "pick orange", at: SWATCH_CLICK, path: PATH, rect: ORANGE_SWATCH },
];

const isPressed = (frame: number, at: number) => Math.abs(frame - at) < 3;

export const Select = () => {
  const frame = useCurrentFrame();
  const enter = tween(frame, 0, 16);
  const zoom = 1 + PUSH * tween(frame, 16, 40);
  const pointer = pointerAt(frame, PATH);
  const state = {
    ...APP_REST,
    hover: tween(frame, SELECT_CLICK - 8, 5),
    selected: tween(frame, SELECT_CLICK, 4),
    headColor: frame >= SWATCH_CLICK ? SWATCHES[1] : SWATCHES[0],
    presses: [
      { rect: HEAD, amount: pressAmount(frame, SELECT_CLICK) },
      { rect: ORANGE_SWATCH, amount: pressAmount(frame, SWATCH_CLICK) },
    ],
  };

  return (
    <Section tone={SELECT_TONE}>
      <Place x={0} y={62} style={{ width: 1920 }}>
        <Headline lines={["edit your running app visually."]} boxed="visually" tone={SELECT_TONE} size={96} align={Align.Center} />
      </Place>
      <Place x={APP_AT.x} y={APP_AT.y} style={{ transform: `translateY(${(1 - enter) * RISE}px)` }}>
        <div style={{ position: "relative", transform: `scale(${zoom})`, transformOrigin: `${FOCUS.x}px ${FOCUS.y}px` }}>
          <AppShot state={state} />
          {frame >= PATH[0].at ? <Pointer x={pointer.x} y={pointer.y} pressed={isPressed(frame, SELECT_CLICK) || isPressed(frame, SWATCH_CLICK)} scale={zoom * POINTER_SIZE} /> : null}
        </div>
      </Place>
    </Section>
  );
};
