import { useCurrentFrame } from "remotion";
import { glide, lift, mix, tween } from "../../ease";
import { Sound, type Cue } from "../../components/Sfx";
import { FPS } from "../../timing";
import { MUSIC } from "../beat";
import { Align, Headline, assembleTicks, boxPopAt } from "../Headline";
import { Landscape } from "../Landscape";
import { noise } from "../motion";
import { IconRow, Pixel, type Sprite } from "../pixel";
import { PixelWord, wordBlocks } from "../PixelWord";
import { Pointer, pointerAt, type Click, type Waypoint } from "../Pointer";
import { EditorFrame } from "../editor/EditorFrame";
import { EDITOR_REST, FeegaEditor, pressAmount } from "../editor/FeegaEditor";
import { MESH_BOX, WIN, center, inside, type Rect } from "../editor/layout";
import { ICON_PICK, OBJECT_PICK, Plugin, PluginInsert, PluginPanel, gridCell, pluginTab } from "../editor/PluginPanel";
import { Place, Section } from "../Section";
import { BLUE, DISPLAY, INK, ORANGE, PAPER, Tone, UI, WHITE } from "../style";

const BEAT = (FPS * 60) / MUSIC.bpm;
const beats = (n: number) => Math.round(n * BEAT);

export const PLUGINS_FRAMES = beats(15);
export const PLUGINS_TONE = Tone.Ink;

const WORD = "plugins";
const WORD_CELL = 52;
const WORD_IN = 12;
const WORD_RISE = 220;
const TILE = 120;
const TILE_COLS = 16;
const TILE_ROWS = 9;
const TILE_SPAN = 10;
const EDITOR_IN = beats(2);
const WORD_OUT = EDITOR_IN + 2;
const EDITOR_AT = { x: (1920 - WIN.w) / 2, y: (1080 - WIN.h) / 2 + 10, scale: 1 };

export const DRAG_FROM = beats(3);
const DRAG_END = beats(4);
const PANEL_AT = DRAG_END + 2;
const ICONS_TAB = beats(4.5);
const ICON_CLICK = beats(5);
const OBJECT_TAB = beats(5.5);
const OBJECT_CLICK = beats(6);
const TYPE_TAB = beats(6.5);
const ARRIVE = 3;

const CARD_AT = beats(7.5);
const HEAD_AT = CARD_AT + 16;
const SCROLL_STEPS = [9.5, 10.5, 11.5].map(beats);
const SCROLL_ROWS = 2;
const SCROLL_SPAN = 8;
const PICK_CLICK = beats(12.5);

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

const EDITOR_PATH: Waypoint[] = [
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

type Listing = { name: string; about: string; sprite: Sprite; unread?: true };

const LISTINGS: Listing[] = [
  { name: "Fontsource fonts", about: "Every open font, one click away", sprite: "font" },
  { name: "Unsplash images", about: "Search photos, drop them in", sprite: "image", unread: true },
  { name: "Google Material Icons", about: "Thousands of icons, any weight", sprite: "grid" },
  { name: "Lucide icons", about: "Clean stroke icons that match", sprite: "ring" },
  { name: "Feather icons", about: "Light, simple, open source", sprite: "feather", unread: true },
  { name: "Multi-point mesh gradient", about: "Drag points, blend colours", sprite: "mesh" },
  { name: "Animated gradients", about: "Gradients that move, as CSS", sprite: "wave" },
  { name: "Stickers", about: "Peel, place, rotate", sprite: "sticker", unread: true },
  { name: "3D objects", about: "Spin a model into the page", sprite: "cube" },
  { name: "3D text", about: "Extruded type, real depth", sprite: "type", unread: true },
  { name: "Noise & grain", about: "Film grain over any layer", sprite: "grain" },
  { name: "Shadows generator", about: "Soft, layered, realistic", sprite: "shadow" },
  { name: "Charts", about: "Bars and lines from your data", sprite: "chart", unread: true },
  { name: "Lottie", about: "Play animations inline", sprite: "play" },
  { name: "QR codes", about: "Any link, scannable", sprite: "qr" },
];

const CARD = { x: 1010, y: 100, w: 800, h: 880 };
const CARD_PAD = 30;
const LIST_TOP = CARD.y + 128;
const ROW_H = 118;
const ROW_GAP = 10;
const PICK = 10;
const FINAL_SCROLL = SCROLL_STEPS.length * SCROLL_ROWS * ROW_H;
const MUTED = "#8a8780";
const HOVER = "#ecebe6";
const TEAMMATE = "#e255a1";
const HOVER_UNTIL = PICK_CLICK + 24;

const rowRect = (i: number, scroll: number): Rect => ({ x: CARD.x + CARD_PAD - 12, y: LIST_TOP + i * ROW_H - scroll, w: CARD.w - 2 * CARD_PAD + 24, h: ROW_H - ROW_GAP });

const PICK_RECT = rowRect(PICK, FINAL_SCROLL);
const PICK_AT = center(PICK_RECT);

const CARD_PATH: Waypoint[] = [
  { at: SCROLL_STEPS[0], x: 1780, y: 1060 },
  { at: SCROLL_STEPS[2] - 4, x: 1520, y: 760 },
  { at: PICK_CLICK - 2, ...PICK_AT },
  { at: PICK_CLICK + 1, ...PICK_AT },
  { at: PLUGINS_FRAMES, x: PICK_AT.x + 120, y: PICK_AT.y + 150 },
];

export const PLUGINS_CLICKS: Click[] = [
  { label: "grab mesh point", at: DRAG_FROM, path: EDITOR_PATH, rect: HANDLE },
  ...TARGETS.map((t) => ({ label: t.label, at: t.at, path: EDITOR_PATH, rect: t.rect })),
  { label: "install plugin", at: PICK_CLICK, path: CARD_PATH, rect: PICK_RECT },
];

const EDITOR_CLICKS = PLUGINS_CLICKS.filter((c) => c.path === EDITOR_PATH);

const WORD_TICKS = [0, 4, 8];

export const PLUGINS_CUES: Cue[] = [
  ...WORD_TICKS.map((at) => ({ at, sound: Sound.Tap, volume: 0.3 })),
  { at: WORD_IN, sound: Sound.Pop, volume: 0.55 },
  { at: EDITOR_IN, sound: Sound.Whoosh, volume: 0.35 },
  ...PLUGINS_CLICKS.map((c) => ({ at: c.at, sound: Sound.ClickB, volume: 0.6 })),
  ...[ICON_CLICK, OBJECT_CLICK, TYPE_TAB].map((at) => ({ at: at + 2, sound: Sound.Pop, volume: 0.45 })),
  { at: CARD_AT, sound: Sound.Whoosh, volume: 0.4 },
  ...assembleTicks(HEAD_AT).map((at) => ({ at, sound: Sound.Tap, volume: 0.12 })),
  { at: boxPopAt(HEAD_AT), sound: Sound.Pop, volume: 0.55, beat: true },
  ...SCROLL_STEPS.map((at) => ({ at, sound: Sound.Tap, volume: 0.25 })),
  { at: PICK_CLICK + 2, sound: Sound.Pop, volume: 0.5 },
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

const tileAt = (x: number, y: number) => CARD_AT + ((x + y) / (TILE_COLS + TILE_ROWS)) * TILE_SPAN + noise(x * 31 + y) * 4;

const InkTiles = () => {
  const frame = useCurrentFrame();

  if (frame < CARD_AT) {
    return null;
  }

  return (
    <>
      {Array.from({ length: TILE_COLS * TILE_ROWS }, (_, i) => {
        const x = i % TILE_COLS;
        const y = Math.floor(i / TILE_COLS);
        const flip = tween(frame, tileAt(x, y), 6);

        return flip > 0 ? <div key={i} style={{ position: "absolute", left: x * TILE, top: y * TILE, width: TILE + 1, height: TILE + 1, background: INK, transform: `perspective(600px) rotateX(${(1 - flip) * 90}deg)` }} /> : null;
      })}
    </>
  );
};

const Word = () => {
  const frame = useCurrentFrame();
  const { cols, rows } = wordBlocks(WORD);
  const rise = lift(frame, WORD_OUT, 16) * WORD_RISE;

  if (frame > WORD_OUT + 20) {
    return null;
  }

  return (
    <div style={{ position: "absolute", left: (1920 - cols * WORD_CELL) / 2, top: (1080 - rows * WORD_CELL) / 2 - rise }}>
      <PixelWord word={WORD} cell={WORD_CELL} color={WHITE} scaleOf={(b) => lift(frame, b.seed * (WORD_IN - 6), 6) * (1 - tween(frame, WORD_OUT + b.seed * 10, 6))} />
    </div>
  );
};

const scrollAt = (frame: number) => SCROLL_STEPS.reduce((sum, at) => sum + tween(frame, at, SCROLL_SPAN) * SCROLL_ROWS * ROW_H, 0);

const Installed = ({ amount }: { amount: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 8px 12px", borderRadius: 999, background: BLUE, color: WHITE, fontFamily: UI, fontSize: 20, fontWeight: 600, transform: `scale(${amount})` }}>
    <svg width={20} height={20} viewBox="0 0 20 20">
      <path d="M4 10.5 L8.5 15 L16 6" fill="none" stroke={WHITE} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    installed
  </div>
);

const Marker = ({ listing, installed }: { listing: Listing; installed: number }) => {
  if (installed > 0) {
    return <Installed amount={installed} />;
  }

  return listing.unread ? <div style={{ width: 14, height: 14, borderRadius: 7, background: BLUE, marginRight: 14 }} /> : null;
};

const Row = ({ listing, rect, hovered, installed }: { listing: Listing; rect: Rect; hovered: boolean; installed: number }) => (
  <div style={{ position: "absolute", left: rect.x - CARD.x, top: rect.y - CARD.y, width: rect.w, height: rect.h, borderRadius: 22, background: hovered ? HOVER : "transparent", display: "flex", alignItems: "center", gap: 24, padding: "0 12px" }}>
    <div style={{ width: 84, height: 84, borderRadius: 20, background: WHITE, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Pixel sprite={listing.sprite} size={7} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 620, letterSpacing: "-0.03em", color: INK }}>{listing.name}</div>
      <div style={{ fontFamily: UI, fontSize: 22, color: MUTED, marginTop: 4 }}>{listing.about}</div>
    </div>
    <Marker listing={listing} installed={installed} />
  </div>
);

const TagCursor = ({ x, y, pressed }: { x: number; y: number; pressed: boolean }) => (
  <div style={{ position: "absolute", left: x - 2, top: y - 2, zIndex: 50, transform: `scale(${pressed ? 0.86 : 1})`, transformOrigin: "2px 2px" }}>
    <svg width={34} height={40} viewBox="0 0 17 20" style={{ display: "block", filter: "drop-shadow(0 3px 6px rgba(0,0,0,.3))" }}>
      <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill={TEAMMATE} stroke={WHITE} strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
    <span style={{ position: "absolute", left: 28, top: 34, padding: "4px 12px", borderRadius: 999, background: TEAMMATE, color: WHITE, fontFamily: UI, fontSize: 18, fontWeight: 600, whiteSpace: "nowrap" }}>Maya</span>
  </div>
);

const Catalogue = () => {
  const frame = useCurrentFrame();
  const enter = tween(frame, CARD_AT + 4, 14);
  const scroll = scrollAt(frame);
  const tip = pointerAt(frame, CARD_PATH);
  const cursorIn = frame >= SCROLL_STEPS[0];
  const installed = lift(frame, PICK_CLICK + 2, 8);

  if (frame < CARD_AT) {
    return null;
  }

  return (
    <>
      {frame >= HEAD_AT ? (
        <Place x={120} y={330}>
          <Headline lines={["plugins for", "everything."]} boxed="everything" tone={PLUGINS_TONE} size={112} align={Align.Left} start={HEAD_AT} />
        </Place>
      ) : null}
      <Place x={128} y={660}>
        <IconRow sprites={["plug", "mesh", "cube", "type", "palette", "star"]} size={9} start={HEAD_AT + 14} gap={34} stagger={3} />
      </Place>
      <div style={{ position: "absolute", left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: 44, background: PAPER, overflow: "hidden", transform: `translateX(${(1 - enter) * 1000}px) rotate(${(1 - enter) * 6}deg)` }}>
        <div style={{ position: "absolute", left: CARD_PAD + 12, top: 44, fontFamily: UI, fontSize: 24, fontWeight: 600, color: MUTED }}>Plugins</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: LIST_TOP - CARD.y - 16, maskImage: "linear-gradient(transparent, #000 40px, #000 calc(100% - 90px), transparent)" }}>
          <div style={{ position: "absolute", left: 0, top: CARD.y - LIST_TOP + 16 }}>
            {LISTINGS.map((listing, i) => {
              const rect = rowRect(i, scroll);
              const hovered = cursorIn && frame <= HOVER_UNTIL && inside(tip, rect);

              return <Row key={listing.name} listing={listing} rect={rect} hovered={hovered} installed={i === PICK ? installed : 0} />;
            })}
          </div>
        </div>
      </div>
      {cursorIn ? <TagCursor x={tip.x} y={tip.y} pressed={Math.abs(frame - PICK_CLICK) < 3} /> : null}
    </>
  );
};

export const Plugins = () => {
  const frame = useCurrentFrame();
  const enter = tween(frame, EDITOR_IN, 14);
  const leave = glide(frame, CARD_AT, 12);
  const drag = tween(frame, DRAG_FROM, DRAG_END - DRAG_FROM);
  const points = POINTS.map((p, i) => (i === 0 ? { ...p, x: mix(p.x, DROP.x - MESH_BOX.x, drag), y: mix(p.y, DROP.y - MESH_BOX.y, drag) } : p));
  const dragging = frame >= DRAG_FROM && frame <= DRAG_END;
  const pointer = dragging ? { x: MESH_BOX.x + points[0].x, y: MESH_BOX.y + points[0].y } : pointerAt(frame, EDITOR_PATH);
  const pressed = dragging || EDITOR_CLICKS.some((c) => Math.abs(frame - c.at) < 3);
  const zoom = 1 + 0.08 * tween(frame, EDITOR_IN + 10, 40);
  const panel = latest(PANELS, frame);
  const insert = latest(INSERTS, frame);
  const angle = frame * 4;
  const picked = panel?.plugin === Plugin.Icons && frame >= ICON_CLICK ? ICON_PICK : panel?.plugin === Plugin.Object && frame >= OBJECT_CLICK ? OBJECT_PICK : -1;
  const landscapeOn = frame < CARD_AT + TILE_SPAN + 12;

  return (
    <Section tone={PLUGINS_TONE}>
      {landscapeOn ? (
        <div style={{ position: "absolute", inset: 0, transform: `scale(${1.08 - 0.08 * tween(frame, 0, 60)})` }}>
          <Landscape cols={192} rows={108} seed={7} width={1920} height={1080} />
        </div>
      ) : null}
      <Word />
      <InkTiles />
      {frame >= EDITOR_IN && leave < 1 ? (
        <EditorFrame x={EDITOR_AT.x} y={EDITOR_AT.y + (1 - enter) * 900 + leave * 1100} scale={EDITOR_AT.scale} enter={1} zoom={zoom} focus={center(MESH_BOX)}>
          <FeegaEditor state={{ ...EDITOR_REST, selected: 1, mesh: points, presses: [{ rect: HANDLE, amount: pressAmount(frame, DRAG_FROM) }] }} />
          {panel ? <PluginPanel plugin={panel.plugin} angle={angle} picked={picked} /> : null}
          {insert ? <PluginInsert plugin={insert.plugin} amount={lift(frame, insert.at, 8)} angle={angle} /> : null}
          <Pointer x={pointer.x} y={pointer.y} pressed={pressed} scale={EDITOR_AT.scale * zoom} />
        </EditorFrame>
      ) : null}
      <Catalogue />
    </Section>
  );
};
