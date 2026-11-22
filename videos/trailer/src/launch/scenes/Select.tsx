import { useCurrentFrame } from "remotion";
import { tween } from "../../ease";
import { EditorFrame } from "../editor/EditorFrame";
import { EDITOR_REST, FeegaEditor, pressAmount } from "../editor/FeegaEditor";
import { BASE_FONT, center, h1Rect } from "../editor/layout";
import { Align, Headline } from "../Headline";
import { Pointer, pointerAt, type Click } from "../Pointer";
import { Scatter, specks } from "../pixel";
import { Place, Section } from "../Section";
import { BLUE, ORANGE, Tone } from "../style";

export const SELECT_FRAMES = 110;
export const SELECT_TONE = Tone.Raised;
export const SELECT_CLICK = 66;

export const EDITOR_AT = { x: 970, y: 300, scale: 0.72 };

const H1 = h1Rect(BASE_FONT);
const TARGET = { x: H1.x + 130, y: H1.y + 34 };
const SPECKS = specks(2, 14, [ORANGE, BLUE]);
const PATH = [
  { at: 24, x: 1000, y: 680 },
  { at: SELECT_CLICK - 8, x: TARGET.x, y: TARGET.y },
];

export const SELECT_CLICKS: Click[] = [{ label: "select h1", at: SELECT_CLICK, path: PATH, rect: H1 }];

export const Select = () => {
  const frame = useCurrentFrame();
  const zoom = 1 + 0.22 * tween(frame, 46, 22) - 0.22 * tween(frame, 92, 16);
  const pointer = pointerAt(frame, PATH);

  return (
    <Section tone={SELECT_TONE} eyebrow="01 · select">
      <Scatter specks={SPECKS} />
      <Place x={100} y={340}>
        <Headline lines={["click any", "element of your", "running app."]} boxed="app" tone={SELECT_TONE} size={100} align={Align.Left} />
      </Place>
      <EditorFrame x={EDITOR_AT.x} y={EDITOR_AT.y} scale={EDITOR_AT.scale} enter={tween(frame, 4, 20)} zoom={zoom} focus={center(H1)}>
        <FeegaEditor state={{ ...EDITOR_REST, hover: tween(frame, 50, 6), selected: tween(frame, SELECT_CLICK, 6), presses: [{ rect: H1, amount: pressAmount(frame, SELECT_CLICK) }] }} />
        {frame >= PATH[0].at ? <Pointer x={pointer.x} y={pointer.y} pressed={Math.abs(frame - SELECT_CLICK) < 3} scale={EDITOR_AT.scale * zoom} /> : null}
      </EditorFrame>
    </Section>
  );
};
