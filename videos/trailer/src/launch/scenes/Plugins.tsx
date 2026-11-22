import { useCurrentFrame } from "remotion";
import { mix, tween } from "../../ease";
import { Align, Headline } from "../Headline";
import { float } from "../motion";
import { Scatter, hop, specks } from "../pixel";
import { Pointer, pointerAt } from "../Pointer";
import { Place, Section } from "../Section";
import { BLUE, ORANGE, PAPER, Tone } from "../style";

export const PLUGINS_FRAMES = 105;
export const PLUGINS_TONE = Tone.Paper;

const ORBIT = 26;
export const DRAG_FROM = 24;

const MESH_W = 620;
const MESH_H = 420;
const CUBE = 170;
const SPECKS = specks(6, 18, [ORANGE, BLUE]);

const POINTS = [
  { x: 120, y: 100, c: ORANGE },
  { x: 500, y: 90, c: "#ffb36b" },
  { x: 140, y: 330, c: BLUE },
  { x: 470, y: 320, c: "#c026d3" },
];

const DRAG_TO = { x: 330, y: 250 };

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
  const pointer = pointerAt(frame, [
    { at: 6, x: 560, y: 500 },
    { at: DRAG_FROM, x: POINTS[0].x, y: POINTS[0].y },
  ]);
  const held = frame >= DRAG_FROM ? points[0] : pointer;
  const background = points.map((p) => `radial-gradient(circle at ${p.x}px ${p.y}px, ${p.c} 0, transparent 62%)`).join(", ");

  return (
    <Section tone={PLUGINS_TONE} eyebrow="05 · plugins">
      <Scatter specks={SPECKS} />
      <Place x={100} y={380}>
        <Headline lines={["plugins, if you", "want more."]} boxed="more" tone={Tone.Paper} size={116} align={Align.Left} />
      </Place>
      <Place x={1060} y={250} style={{ transform: `translateX(${(1 - enter) * 1000}px) rotate(${(1 - enter) * 8}deg) translateY(${float(frame, 0, 8)}px)` }}>
        <div style={{ width: MESH_W, height: MESH_H, borderRadius: 18, background: `${background}, ${PAPER}`, position: "relative", boxShadow: "0 30px 80px rgba(0,0,0,.18)" }}>
          {points.map((p, i) => (
            <div key={i} style={{ position: "absolute", left: p.x - 11, top: p.y - 11, width: 22, height: 22, borderRadius: 11, background: "#fff", border: `4px solid ${i === 0 && frame >= DRAG_FROM ? ORANGE : "#0b0b0a"}` }} />
          ))}
          <Pointer x={held.x + 4} y={held.y + 4} pressed={frame >= DRAG_FROM && frame < DRAG_FROM + 36} />
        </div>
      </Place>
      <Place x={1520} y={720} style={{ transform: `translateY(${(1 - tween(frame, 16, 18)) * 600}px)` }}>
        <div style={{ transform: `translateY(${hop(frame, 0) * 1.5}px)` }}>
          <Cube angle={frame * 4} />
        </div>
      </Place>
    </Section>
  );
};
