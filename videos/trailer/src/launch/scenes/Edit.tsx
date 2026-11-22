import { useCurrentFrame } from "remotion";
import { mix, tween } from "../../ease";
import { CARD_GEOMETRY, EditorCard, SWATCHES } from "../EditorCard";
import { Align, Headline } from "../Headline";
import { Pointer, pointerAt } from "../Pointer";
import { Place, Section } from "../Section";
import { INK, Tone } from "../style";
import { BASE_FONT, CardFrame } from "./Select";

export const EDIT_FRAMES = 120;
export const SCRUB_FROM = 26;
export const SWATCH_CLICK = 70;
export const COLOR_CLICK = 92;

const TARGET_FONT = 80;
const SWATCH_STEP = 36;
const { sizeField, swatch } = CARD_GEOMETRY;
const ORANGE_SWATCH = { x: swatch.x + 14 + SWATCH_STEP, y: swatch.y + 52 };

const PATH = [
  { at: 0, x: CARD_GEOMETRY.heading.x + 120, y: CARD_GEOMETRY.heading.y + 30 },
  { at: 22, x: sizeField.x, y: sizeField.y },
  { at: SCRUB_FROM, x: sizeField.x, y: sizeField.y },
  { at: 58, x: sizeField.x + 120, y: sizeField.y },
  { at: SWATCH_CLICK - 2, x: swatch.x + 10, y: swatch.y + 10 },
  { at: COLOR_CLICK - 2, x: ORANGE_SWATCH.x, y: ORANGE_SWATCH.y },
];

const isPressed = (frame: number, at: number) => frame >= at - 2 && frame < at + 4;

export const Edit = () => {
  const frame = useCurrentFrame();
  const pointer = pointerAt(frame, PATH);
  const fontSize = Math.round(mix(BASE_FONT, TARGET_FONT, tween(frame, SCRUB_FROM, 32)));
  const scrubbing = frame >= SCRUB_FROM - 4 && frame < 64;
  const pressed = scrubbing || isPressed(frame, SWATCH_CLICK) || isPressed(frame, COLOR_CLICK);
  const headColor = frame >= COLOR_CLICK ? SWATCHES[1] : INK;

  return (
    <Section tone={Tone.Paper} eyebrow="02 · edit">
      <Place x={100} y={380}>
        <Headline lines={["edit it", "like in figma."]} boxed="figma" tone={Tone.Paper} size={120} align={Align.Left} />
      </Place>
      <CardFrame enter={1}>
        <EditorCard state={{ hover: 1, selected: 1, fontSize, headColor, scrubbing, swatchOpen: tween(frame, SWATCH_CLICK, 8) }} />
        <Pointer x={pointer.x} y={pointer.y} pressed={pressed} />
      </CardFrame>
    </Section>
  );
};
