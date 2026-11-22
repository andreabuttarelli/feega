import { useCurrentFrame } from "remotion";
import { tween } from "../../ease";
import { CARD_GEOMETRY, EditorCard } from "../EditorCard";
import { Align, Headline } from "../Headline";
import { Pointer, pointerAt } from "../Pointer";
import { Scatter, specks } from "../pixel";
import { Place, Section } from "../Section";
import { BLUE, INK, ORANGE, Tone } from "../style";

export const SELECT_FRAMES = 114;
export const SELECT_TONE = Tone.Ink;
export const SELECT_CLICK = 70;
export const BASE_FONT = 56;

export const CARD_SCALE = 0.78;
export const CARD_X = 930;
export const CARD_Y = 300;

const { heading } = CARD_GEOMETRY;
const SPECKS = specks(2, 14, [ORANGE, BLUE]);
const PATH = [
  { at: 26, x: 1000, y: 640 },
  { at: 58, x: heading.x + 120, y: heading.y + 30 },
];

const ENTER_TILT = 8;
const PUSH_ORIGIN = `${heading.x + 120}px ${heading.y + 30}px`;

export const CardFrame = ({ enter, zoom, origin, children }: { enter: number; zoom: number; origin: string; children: React.ReactNode }) => (
  <Place x={CARD_X} y={CARD_Y} style={{ transform: `translateX(${(1 - enter) * 1100}px) rotate(${(1 - enter) * ENTER_TILT}deg) scale(${CARD_SCALE})`, transformOrigin: "0 0" }}>
    <div style={{ transform: `scale(${zoom})`, transformOrigin: origin }}>{children}</div>
  </Place>
);

export const Select = () => {
  const frame = useCurrentFrame();
  const enter = tween(frame, 4, 20);
  const zoom = 1 + 0.16 * tween(frame, 50, 22) - 0.16 * tween(frame, 96, 16);
  const pointer = pointerAt(frame, PATH);
  const hover = tween(frame, 52, 6);
  const selected = tween(frame, SELECT_CLICK, 8);
  const pressed = frame >= SELECT_CLICK - 2 && frame < SELECT_CLICK + 4;

  return (
    <Section tone={SELECT_TONE} eyebrow="01 · select">
      <Scatter specks={SPECKS} />
      <Place x={100} y={330}>
        <Headline lines={["click any", "element of your", "running app."]} boxed="app" tone={Tone.Ink} size={104} align={Align.Left} />
      </Place>
      <CardFrame enter={enter} zoom={zoom} origin={PUSH_ORIGIN}>
        <EditorCard state={{ hover, selected, fontSize: BASE_FONT, headColor: INK, scrubbing: false, swatchOpen: 0 }} />
        {frame >= PATH[0].at ? <Pointer x={pointer.x} y={pointer.y} pressed={pressed} /> : null}
      </CardFrame>
    </Section>
  );
};
