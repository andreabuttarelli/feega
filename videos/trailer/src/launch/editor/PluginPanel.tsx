import type { CSSProperties, ReactNode } from "react";
import { GLYPH, type Glyph } from "./glyphs";
import { BODY_Y, MESH_BOX, RIGHT_W, RIGHT_X, SIDE_PAD, WIN, type Rect } from "./layout";

export enum Plugin {
  Mesh = "Mesh",
  Icons = "Icons",
  Object = "3D object",
  Type = "3D text",
}

const ORDER = [Plugin.Mesh, Plugin.Icons, Plugin.Object, Plugin.Type];
const TAB_H = 26;
const TAB_Y = BODY_Y + 10;
const TAB_GAP = 4;
const TAB_W = (RIGHT_W - 2 * SIDE_PAD - TAB_GAP * (ORDER.length - 1)) / ORDER.length;
const GRID_Y = TAB_Y + TAB_H + 54;
const CELL = 50;
const CELL_GAP = 6;
const GRID_COLS = 5;

export const pluginTab = (plugin: Plugin): Rect => ({ x: RIGHT_X + SIDE_PAD + ORDER.indexOf(plugin) * (TAB_W + TAB_GAP), y: TAB_Y, w: TAB_W, h: TAB_H });
export const gridCell = (i: number): Rect => ({ x: RIGHT_X + SIDE_PAD + (i % GRID_COLS) * (CELL + CELL_GAP), y: GRID_Y + Math.floor(i / GRID_COLS) * (CELL + CELL_GAP), w: CELL, h: CELL });

export const ICON_PICK = 7;
export const OBJECT_PICK = 1;

const ICONS: Glyph[] = ["search", "eye", "theme", "design", "hand", "external", "reload", "plus", "grip", "desktop", "tablet", "phone", "undo", "redo", "x"];

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const PANEL = "#181818";
const TEXT = "#e4e4e4";
const TEXT_2 = "#9c9c9c";
const INPUT = "#282828";
const THUMB = "#5b5a5f";
const ACCENT = "#0a84ff";
const DIVIDER = "#2f2f2f";
const INK = "#14142b";
const LUMEN = "#4f46e5";
const OBJECT_COLORS = ["#ff5100", "#4f46e5", "#1f9d55", "#c026d3", "#ffb36b", "#0a84ff"];

const box = (r: Rect): CSSProperties => ({ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h });

const Ico = ({ name, size }: { name: Glyph; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: GLYPH[name] }} />
);

export const Cube = ({ size, angle, colors }: { size: number; angle: number; colors: string[] }) => {
  const faces = ["", "rotateY(180deg)", "rotateY(90deg)", "rotateY(-90deg)", "rotateX(90deg)", "rotateX(-90deg)"];

  return (
    <div style={{ width: size, height: size, perspective: size * 5 }}>
      <div style={{ width: size, height: size, position: "relative", transformStyle: "preserve-3d", transform: `rotateX(-24deg) rotateY(${angle}deg)` }}>
        {faces.map((t, i) => (
          <div key={i} style={{ position: "absolute", inset: 0, background: colors[i % colors.length], transform: `${t} translateZ(${size / 2}px)`, backfaceVisibility: "hidden" }} />
        ))}
      </div>
    </div>
  );
};

const Grid = ({ count, picked, children }: { count: number; picked: number; children: (i: number) => ReactNode }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} style={{ ...box(gridCell(i)), display: "grid", placeItems: "center", borderRadius: 6, background: INPUT, color: TEXT, boxShadow: i === picked ? `0 0 0 1.5px ${ACCENT}` : "none" }}>
        {children(i)}
      </div>
    ))}
  </>
);

const Row = ({ label, value, y }: { label: string; value: string; y: number }) => (
  <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: y, width: RIGHT_W - 2 * SIDE_PAD, height: 34, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
    <span style={{ width: 72, color: TEXT_2 }}>{label}</span>
    <span style={{ flex: 1, height: 28, display: "flex", alignItems: "center", padding: "0 8px", borderRadius: 4, background: INPUT, color: TEXT }}>{value}</span>
  </div>
);

const BODIES: Record<Plugin, (props: { angle: number; picked: number }) => ReactNode> = {
  [Plugin.Mesh]: () => (
    <>
      <Row label="Points" value="4" y={GRID_Y - 8} />
      <Row label="Blur" value="62 %" y={GRID_Y + 28} />
      <Row label="Noise" value="6 %" y={GRID_Y + 64} />
    </>
  ),
  [Plugin.Icons]: ({ picked }) => <Grid count={ICONS.length} picked={picked}>{(i) => <Ico name={ICONS[i]} size={20} />}</Grid>,
  [Plugin.Object]: ({ angle, picked }) => <Grid count={10} picked={picked}>{(i) => <Cube size={20} angle={angle + i * 30} colors={[OBJECT_COLORS[i % OBJECT_COLORS.length], "#2a2a2a", "#555"]} />}</Grid>,
  [Plugin.Type]: () => (
    <>
      <Row label="Text" value="ship it" y={GRID_Y - 8} />
      <Row label="Depth" value="24 px" y={GRID_Y + 28} />
      <Row label="Bevel" value="2 px" y={GRID_Y + 64} />
      <Row label="Material" value="Matte · indigo" y={GRID_Y + 100} />
    </>
  ),
};

export const PluginPanel = ({ plugin, angle, picked }: { plugin: Plugin; angle: number; picked: number }) => {
  const Body = BODIES[plugin];

  return (
    <div style={{ position: "absolute", left: 0, top: 0, fontFamily: FONT }}>
      <div style={{ ...box({ x: RIGHT_X, y: BODY_Y, w: RIGHT_W, h: WIN.h - BODY_Y }), background: PANEL, borderLeft: `1px solid ${DIVIDER}` }} />
      {ORDER.map((p) => (
        <span key={p} style={{ ...box(pluginTab(p)), display: "grid", placeItems: "center", borderRadius: 5, fontSize: 12, whiteSpace: "nowrap", background: p === plugin ? THUMB : INPUT, color: p === plugin ? "#fff" : TEXT_2 }}>{p}</span>
      ))}
      <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: TAB_Y + TAB_H + 18, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: TEXT }}>
        {plugin}
        <span style={{ padding: "1px 6px", borderRadius: 999, background: "rgba(255,81,0,.18)", color: "#ff8a3d", fontWeight: 500, fontSize: 10 }}>plugin</span>
      </div>
      <Body angle={angle} picked={picked} />
    </div>
  );
};

const SPOT = { x: MESH_BOX.x + MESH_BOX.w - 190, y: MESH_BOX.y + 110 };
const TYPE_LAYERS = 14;

const INSERTS: Record<Plugin, (props: { angle: number }) => ReactNode> = {
  [Plugin.Mesh]: () => null,
  [Plugin.Icons]: () => (
    <span style={{ display: "grid", placeItems: "center", width: 140, height: 140, borderRadius: 32, background: "#fff", color: LUMEN, boxShadow: "0 20px 40px rgba(20,20,43,.25)" }}>
      <Ico name={ICONS[ICON_PICK]} size={84} />
    </span>
  ),
  [Plugin.Object]: ({ angle }) => (
    <div style={{ padding: 10 }}>
      <Cube size={120} angle={angle} colors={["#ff5100", "#ff8a3d", LUMEN, "#3a32b8", "#ffb36b", "#c2410c"]} />
    </div>
  ),
  [Plugin.Type]: ({ angle }) => (
    <div style={{ position: "relative", fontFamily: '"BDO Grotesk", sans-serif', fontSize: 60, fontWeight: 700, letterSpacing: "-0.05em", whiteSpace: "nowrap", transform: `translateY(150px) rotateY(${-18 + 10 * Math.sin(angle / 40)}deg) rotateX(12deg)`, transformStyle: "preserve-3d" }}>
      {Array.from({ length: TYPE_LAYERS }, (_, i) => (
        <span key={i} style={{ position: i ? "absolute" : "relative", left: 0, top: 0, color: i === TYPE_LAYERS - 1 ? "#fff" : i > TYPE_LAYERS - 3 ? "#c7cbee" : INK, transform: `translate(${i * 0.9}px, ${-i * 0.9}px)` }}>ship it</span>
      ))}
    </div>
  ),
};

export const PluginInsert = ({ plugin, amount, angle }: { plugin: Plugin; amount: number; angle: number }) => {
  const Insert = INSERTS[plugin];

  return (
    <div style={{ position: "absolute", left: SPOT.x, top: SPOT.y, transform: `scale(${amount})`, transformOrigin: "50% 50%", perspective: 900 }}>
      <Insert angle={angle} />
    </div>
  );
};
