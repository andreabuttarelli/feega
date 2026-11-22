import { useCurrentFrame } from "remotion";
import { mix, tween } from "../../ease";
import { EditorFrame } from "../editor/EditorFrame";
import { EDITOR_REST, FeegaEditor, SWATCHES, pressAmount } from "../editor/FeegaEditor";
import { BASE_FONT, COLOUR_FIELD, FONT_SIZE_FIELD, center, h1Rect, swatchRect } from "../editor/layout";
import { Align, Headline } from "../Headline";
import { Pointer, pointerAt, type Click } from "../Pointer";
import { Place, Section } from "../Section";
import { Tone } from "../style";
import { EDITOR_AT } from "./Select";

export const EDIT_FRAMES = 120;
export const EDIT_TONE = Tone.White;
export const SCRUB_FROM = 26;
export const SWATCH_CLICK = 70;
export const COLOR_CLICK = 92;

const TARGET_FONT = 76;
const SCRUB_REACH = 70;
const ORANGE_SWATCH = swatchRect(1);
const H1 = h1Rect(BASE_FONT);
const FIELD = center(FONT_SIZE_FIELD);
const COLOUR = { x: COLOUR_FIELD.x + 14, y: COLOUR_FIELD.y + 14 };

const PATH = [
  { at: 0, x: H1.x + 130, y: H1.y + 34 },
  { at: SCRUB_FROM - 4, x: FIELD.x, y: FIELD.y },
  { at: SCRUB_FROM, x: FIELD.x, y: FIELD.y },
  { at: 58, x: FIELD.x + SCRUB_REACH, y: FIELD.y },
  { at: SWATCH_CLICK - 4, x: COLOUR.x, y: COLOUR.y },
  { at: COLOR_CLICK - 4, ...center(ORANGE_SWATCH) },
];

export const EDIT_CLICKS: Click[] = [
  { label: "scrub font size", at: SCRUB_FROM, path: PATH, rect: FONT_SIZE_FIELD },
  { label: "open colour", at: SWATCH_CLICK, path: PATH, rect: COLOUR_FIELD },
  { label: "pick orange", at: COLOR_CLICK, path: PATH, rect: ORANGE_SWATCH },
];

const isPressed = (frame: number, at: number) => frame >= at - 2 && frame < at + 4;

export const Edit = () => {
  const frame = useCurrentFrame();
  const pointer = pointerAt(frame, PATH);
  const fontSize = Math.round(mix(BASE_FONT, TARGET_FONT, tween(frame, SCRUB_FROM, 32)));
  const scrubbing = frame >= SCRUB_FROM - 2 && frame < 62;
  const pressed = scrubbing || isPressed(frame, SWATCH_CLICK) || isPressed(frame, COLOR_CLICK);
  const zoom = 1 + 0.3 * tween(frame, 10, 18) - 0.3 * tween(frame, 60, 16) + 0.26 * tween(frame, 78, 14);
  const focus = frame < 77 ? FIELD : center(ORANGE_SWATCH);
  const headColor = frame >= COLOR_CLICK ? SWATCHES[1] : SWATCHES[0];
  const swatches = tween(frame, SWATCH_CLICK, 8) * (1 - tween(frame, COLOR_CLICK + 12, 8));
  const presses = [
    { rect: FONT_SIZE_FIELD, amount: pressAmount(frame, SCRUB_FROM) },
    { rect: COLOUR_FIELD, amount: pressAmount(frame, SWATCH_CLICK) },
    { rect: ORANGE_SWATCH, amount: pressAmount(frame, COLOR_CLICK) },
  ];

  return (
    <Section tone={EDIT_TONE} eyebrow="02 · edit">
      <Place x={100} y={380}>
        <Headline lines={["edit it", "like in Figma."]} boxed="Figma" tone={EDIT_TONE} size={116} align={Align.Left} />
      </Place>
      <EditorFrame x={EDITOR_AT.x} y={EDITOR_AT.y} scale={EDITOR_AT.scale} enter={tween(frame, 0, 14)} zoom={zoom} focus={focus}>
        <FeegaEditor state={{ ...EDITOR_REST, hover: 1, selected: 1, fontSize, headColor, scrub: scrubbing, swatches, changes: frame >= COLOR_CLICK ? 8 : 0, presses }} />
        <Pointer x={pointer.x} y={pointer.y} pressed={pressed} scale={EDITOR_AT.scale * zoom} />
      </EditorFrame>
    </Section>
  );
};
