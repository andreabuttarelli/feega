import { useCurrentFrame } from "remotion";
import { mix, tween } from "../../ease";
import { Align, Headline } from "../Headline";
import { float } from "../motion";
import { Scatter, hop, specks } from "../pixel";
import { Pointer, pointerAt, type Click } from "../Pointer";
import { EditorFrame } from "../editor/EditorFrame";
import { EDITOR_REST, FeegaEditor, pressAmount } from "../editor/FeegaEditor";
import { MESH_BOX } from "../editor/layout";
import { EDITOR_AT } from "./Select";
import { Place, Section } from "../Section";
import { BLUE, ORANGE, Tone } from "../style";

export const PLUGINS_FRAMES = 95;
export const PLUGINS_TONE = Tone.White;

const ORBIT = 26;
export const DRAG_FROM = 24;

const CUBE = 170;
const SPECKS = specks(6, 18, [ORANGE, BLUE]);

const POINTS = [
  { x: 120, y: 100, c: ORANGE },
  { x: 500, y: 90, c: "#ffb36b" },
  { x: 140, y: 330, c: BLUE },
  { x: 470, y: 320, c: "#c026d3" },
];

const DRAG_TO = { x: 330, y: 230 };
const HANDLE = { x: MESH_BOX.x + POINTS[0].x - 10, y: MESH_BOX.y + POINTS[0].y - 10, w: 20, h: 20 };
const PATH = [
  { at: 6, x: 700, y: 660 },
  { at: DRAG_FROM - 4, x: MESH_BOX.x + POINTS[0].x, y: MESH_BOX.y + POINTS[0].y },
];

export const PLUGINS_CLICKS: Click[] = [{ label: "grab mesh point", at: DRAG_FROM, path: PATH, rect: HANDLE }];

const FACES = [
  { t: "", c: ORANGE },
  { t: "rotateY(180deg)", c: "#ff8a3d" },
  { t: "rotateY(90deg)", c: BLUE },
  { t: "rotateY(-90deg)", c: "#0038a8" },
  { t: "rotateX(90deg)", c: "#ffb36b" },
  { t: "rotateX(-90deg)", c: "#c2410c" },
];

const Cube = ({ angle }: { angle: number }) => (
  <div style={{ width: CUBE, height: CUBE, perspective: 900 }}>
    <div style={{ width: CUBE, height: CUBE, position: "relative", transformStyle: "preserve-3d", transform: `rotateX(-24deg) rotateY(${angle}deg)` }}>
      {FACES.map((f, i) => (
        <div key={i} style={{ position: "absolute", inset: 0, background: f.c, transform: `${f.t} translateZ(${CUBE / 2}px)`, backfaceVisibility: "hidden" }} />
      ))}
    </div>
  </div>
);

export const Plugins = () => {
  const frame = useCurrentFrame();
  const enter = tween(frame, 4, 20);
  const drag = tween(frame, DRAG_FROM, 34);
  const points = POINTS.map((p, i) => (i === 0 ? { ...p, x: mix(p.x, DRAG_TO.x, drag), y: mix(p.y, DRAG_TO.y, drag) } : { ...p, x: p.x + float(frame, i * 15, ORBIT), y: p.y + float(frame, i * 15 + 11, ORBIT) }));
  const pointer = pointerAt(frame, PATH);
  const held = frame >= DRAG_FROM ? { x: MESH_BOX.x + points[0].x, y: MESH_BOX.y + points[0].y } : pointer;
  const zoom = 1 + 0.2 * tween(frame, 12, 18) - 0.2 * tween(frame, 70, 16);

  return (
    <Section tone={PLUGINS_TONE} eyebrow="05 · plugins">
      <Scatter specks={SPECKS} />
      <Place x={100} y={380}>
        <Headline lines={["plugins, if you", "want more."]} boxed="more" tone={PLUGINS_TONE} size={116} align={Align.Left} />
      </Place>
      <EditorFrame x={EDITOR_AT.x} y={EDITOR_AT.y} scale={EDITOR_AT.scale} enter={enter} zoom={zoom} focus={{ x: MESH_BOX.x + DRAG_TO.x, y: MESH_BOX.y + DRAG_TO.y }}>
        <FeegaEditor state={{ ...EDITOR_REST, selected: 1, mesh: points, presses: [{ rect: HANDLE, amount: pressAmount(frame, DRAG_FROM) }] }} />
        <Pointer x={held.x} y={held.y} pressed={frame >= DRAG_FROM && frame < DRAG_FROM + 36} scale={EDITOR_AT.scale * zoom} />
      </EditorFrame>
      <Place x={1690} y={840} style={{ transform: `translateY(${(1 - tween(frame, 16, 18)) * 600}px)` }}>
        <div style={{ transform: `translateY(${hop(frame, 0) * 1.5}px)` }}>
          <Cube angle={frame * 4} />
        </div>
      </Place>
    </Section>
  );
};
