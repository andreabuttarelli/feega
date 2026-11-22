import { useCurrentFrame } from "remotion";
import { lift, mix, tween } from "../../ease";
import { Sound, type Cue } from "../../components/Sfx";
import { Landscape } from "../Landscape";
import { noise } from "../motion";
import { PixelWord, wordBlocks } from "../PixelWord";
import { Pointer, pointerAt, type Click, type Waypoint } from "../Pointer";
import { EditorFrame } from "../editor/EditorFrame";
import { EDITOR_REST, FeegaEditor, pressAmount } from "../editor/FeegaEditor";
import { MESH_BOX, WIN, center, type Rect } from "../editor/layout";
import { ICON_PICK, OBJECT_PICK, Plugin, PluginInsert, PluginPanel, gridCell, pluginTab } from "../editor/PluginPanel";
import { Section } from "../Section";
import { BLUE, INK, ORANGE, Tone } from "../style";

export const PLUGINS_FRAMES = 208;
export const PLUGINS_TONE = Tone.White;

const WORD = "plugins";
const WORD_CELL = 52;
const WORD_IN = 16;
const REVEAL_AT = 26;
const REVEAL_SPAN = 18;
const TILE = 120;
const TILE_COLS = 16;
const TILE_ROWS = 9;
const EDITOR_IN = 50;
const EDITOR_AT = { x: (1920 - WIN.w) / 2, y: (1080 - WIN.h) / 2 + 10, scale: 1 };

export const DRAG_FROM = 84;
const DRAG_END = 108;
const PANEL_AT = 112;
const ICONS_TAB = 124;
const ICON_CLICK = 136;
const OBJECT_TAB = 150;
const OBJECT_CLICK = 160;
const TYPE_TAB = 174;
const ARRIVE = 4;

const POINTS = [
  { x: 120, y: 100, c: ORANGE },
  { x: 500, y: 90, c: "#ffb36b" },
  { x: 140, y: 330, c: BLUE },
  { x: 470, y: 320, c: "#c026d3" },
];

const GRAB = { x: MESH_BOX.x + POINTS[0].x, y: MESH_BOX.y + POINTS[0].y };
const DROP = { x: MESH_BOX.x + 330, y: MESH_BOX.y + 230 };
const HANDLE: Rect = { x: GRAB.x - 10, y: GRAB.y - 10, w: 20, h: 20 };

const TARGETS: { at: number; rect: Rect; label: string }[] = [
  { at: ICONS_TAB, rect: pluginTab(Plugin.Icons), label: "icons tab" },
  { at: ICON_CLICK, rect: gridCell(ICON_PICK), label: "pick icon" },
  { at: OBJECT_TAB, rect: pluginTab(Plugin.Object), label: "3d object tab" },
  { at: OBJECT_CLICK, rect: gridCell(OBJECT_PICK), label: "pick object" },
  { at: TYPE_TAB, rect: pluginTab(Plugin.Type), label: "3d text tab" },
];

const PATH: Waypoint[] = [
  { at: EDITOR_IN + 8, x: 700, y: 700 },
  { at: DRAG_FROM - ARRIVE, ...GRAB },
  { at: DRAG_FROM, ...GRAB },
  { at: DRAG_END, ...DROP },
  { at: PANEL_AT, ...DROP },
  ...TARGETS.flatMap((t) => [
    { at: t.at - ARRIVE, ...center(t.rect) },
    { at: t.at + 1, ...center(t.rect) },
  ]),
];

export const PLUGINS_CLICKS: Click[] = [{ label: "grab mesh point", at: DRAG_FROM, path: PATH, rect: HANDLE }, ...TARGETS.map((t) => ({ label: t.label, at: t.at, path: PATH, rect: t.rect }))];

const WORD_TICKS = [0, 4, 8, 12];

export const PLUGINS_CUES: Cue[] = [
  ...WORD_TICKS.map((at) => ({ at, sound: Sound.Tap, volume: 0.3 })),
  { at: WORD_IN, sound: Sound.Pop, volume: 0.55 },
  { at: REVEAL_AT, sound: Sound.Whoosh, volume: 0.4 },
  { at: EDITOR_IN, sound: Sound.Whoosh, volume: 0.35 },
  ...PLUGINS_CLICKS.map((c) => ({ at: c.at, sound: Sound.ClickB, volume: 0.6 })),
  ...[ICON_CLICK, OBJECT_CLICK, TYPE_TAB].map((at) => ({ at: at + 2, sound: Sound.Pop, volume: 0.45 })),
];

const PANELS: { at: number; plugin: Plugin }[] = [
  { at: PANEL_AT, plugin: Plugin.Mesh },
  { at: ICONS_TAB, plugin: Plugin.Icons },
  { at: OBJECT_TAB, plugin: Plugin.Object },
  { at: TYPE_TAB, plugin: Plugin.Type },
];

const INSERTS: { at: number; plugin: Plugin }[] = [
  { at: ICON_CLICK, plugin: Plugin.Icons },
  { at: OBJECT_CLICK, plugin: Plugin.Object },
  { at: TYPE_TAB + 2, plugin: Plugin.Type },
];

const latest = <T extends { at: number }>(events: T[], frame: number) => events.filter((e) => frame >= e.at).pop();

const tileAt = (x: number, y: number) => REVEAL_AT + ((x + y) / (TILE_COLS + TILE_ROWS)) * (REVEAL_SPAN - 6) + noise(x * 31 + y) * 4;

const Reveal = () => {
  const frame = useCurrentFrame();
  const { cols, rows } = wordBlocks(WORD);
  const wordLeft = (1920 - cols * WORD_CELL) / 2;
  const wordTop = (1080 - rows * WORD_CELL) / 2;
  const blockGone = (bx: number, by: number) => {
    const x = Math.floor((wordLeft + bx * WORD_CELL) / TILE);
    const y = Math.floor((wordTop + by * WORD_CELL) / TILE);
    return tween(frame, tileAt(x, y), 5);
  };

  if (frame >= REVEAL_AT + REVEAL_SPAN + 2) {
    return null;
  }

  return (
    <>
      {Array.from({ length: TILE_COLS * TILE_ROWS }, (_, i) => {
        const x = i % TILE_COLS;
        const y = Math.floor(i / TILE_COLS);
        const flip = tween(frame, tileAt(x, y), 6);

        return flip < 1 ? <div key={i} style={{ position: "absolute", left: x * TILE, top: y * TILE, width: TILE + 1, height: TILE + 1, background: "#fff", transform: `perspective(600px) rotateX(${flip * 90}deg)` }} /> : null;
      })}
      <div style={{ position: "absolute", left: wordLeft, top: wordTop }}>
        <PixelWord word={WORD} cell={WORD_CELL} color={INK} scaleOf={(b) => lift(frame, b.seed * (WORD_IN - 6), 6) * (1 - blockGone(b.x, b.y))} />
      </div>
    </>
  );
};

export const Plugins = () => {
  const frame = useCurrentFrame();
  const enter = tween(frame, EDITOR_IN, 16);
  const drag = tween(frame, DRAG_FROM, DRAG_END - DRAG_FROM);
  const points = POINTS.map((p, i) => (i === 0 ? { ...p, x: mix(p.x, DROP.x - MESH_BOX.x, drag), y: mix(p.y, DROP.y - MESH_BOX.y, drag) } : p));
  const dragging = frame >= DRAG_FROM && frame <= DRAG_END;
  const pointer = dragging ? { x: MESH_BOX.x + points[0].x, y: MESH_BOX.y + points[0].y } : pointerAt(frame, PATH);
  const pressed = dragging || PLUGINS_CLICKS.some((c) => Math.abs(frame - c.at) < 3);
  const zoom = 1 + 0.08 * tween(frame, EDITOR_IN + 10, 40);
  const panel = latest(PANELS, frame);
  const insert = latest(INSERTS, frame);
  const angle = frame * 4;
  const picked = panel?.plugin === Plugin.Icons && frame >= ICON_CLICK ? ICON_PICK : panel?.plugin === Plugin.Object && frame >= OBJECT_CLICK ? OBJECT_PICK : -1;

  return (
    <Section tone={PLUGINS_TONE}>
      {frame >= REVEAL_AT ? (
        <div style={{ position: "absolute", inset: 0, transform: `scale(${1.08 - 0.08 * tween(frame, REVEAL_AT, 60)})` }}>
          <Landscape cols={192} rows={108} seed={7} width={1920} height={1080} />
        </div>
      ) : null}
      <Reveal />
      {frame >= EDITOR_IN ? (
        <EditorFrame x={EDITOR_AT.x} y={EDITOR_AT.y + (1 - enter) * 900} scale={EDITOR_AT.scale} enter={1} zoom={zoom} focus={center(MESH_BOX)}>
          <FeegaEditor state={{ ...EDITOR_REST, selected: 1, mesh: points, presses: [{ rect: HANDLE, amount: pressAmount(frame, DRAG_FROM) }] }} />
          {panel ? <PluginPanel plugin={panel.plugin} angle={angle} picked={picked} /> : null}
          {insert ? <PluginInsert plugin={insert.plugin} amount={lift(frame, insert.at, 8)} angle={angle} /> : null}
          <Pointer x={pointer.x} y={pointer.y} pressed={pressed} scale={EDITOR_AT.scale * zoom} />
        </EditorFrame>
      ) : null}
    </Section>
  );
};
