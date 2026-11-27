import { useCurrentFrame } from "remotion";
import { lift, tween } from "../../ease";
import { Sound, type Cue } from "../../components/Sfx";
import { FPS } from "../../timing";
import { MUSIC } from "../beat";
import { Align, Headline, assembleTicks, boxPopAt } from "../Headline";
import { Landscape } from "../Landscape";
import { noise } from "../motion";
import { IconRow, Pixel, type Sprite } from "../pixel";
import { PixelWord, wordBlocks } from "../PixelWord";
import { pointerAt, type Click, type Waypoint } from "../Pointer";
import { center, inside, type Rect } from "../editor/layout";
import { Place, Section } from "../Section";
import { Format, TALL_STAGE, useStage } from "../stage";
import { BLUE, DISPLAY, INK, PAPER, Tone, UI, WHITE } from "../style";

const BEAT = (FPS * 60) / MUSIC.bpm;
const beats = (n: number) => Math.round(n * BEAT);

export const PLUGINS_FRAMES = beats(12);
export const PLUGINS_TONE = Tone.Ink;

const WORD = "plugins";
const WORD_IN = 12;
const WORD_RISE = 220;
const TILE = 120;
const TILE_SPAN = 10;
const WORD_OUT = beats(2);
const CARD_AT = beats(3);
const HEAD_AT = CARD_AT + 16;
const SCROLL_STEPS = [5, 6, 7].map(beats);
const SCROLL_ROWS = 2;
const SCROLL_SPAN = 8;
const PICK_CLICK = beats(9);

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

type Card = Rect;

const LAYOUT = {
  [Format.Wide]: {
    card: { x: 1010, y: 100, w: 800, h: 880 } as Card,
    wordCell: 52,
    tile: { cols: 16, rows: 9 },
    head: { at: { x: 120, y: 330 }, lines: ["plugins for", "everything."], size: 112, align: Align.Left, width: undefined },
    icons: { x: 128, y: 660, size: 9, gap: 34 },
    stage: { width: 1920, height: 1080 },
  },
  [Format.Tall]: {
    card: { x: 40, y: 750, w: 1000, h: 860 } as Card,
    wordCell: 26,
    tile: { cols: 9, rows: 16 },
    head: { at: { x: 0, y: 270 }, lines: ["plugins for", "everything."], size: 150, align: Align.Center, width: 1080 },
    icons: { x: 0, y: 640, size: 7, gap: 28 },
    stage: TALL_STAGE,
  },
};

const CARD_PAD = 30;
const listTop = (card: Card) => card.y + 128;
const ROW_H = 118;
const ROW_GAP = 10;
const PICK = 10;
const FINAL_SCROLL = SCROLL_STEPS.length * SCROLL_ROWS * ROW_H;
const ROW_PAD = 12;
const MUTED = "#8a8780";
const HOVER = "#ecebe6";
const TEAMMATE = "#e255a1";
const HOVER_UNTIL = PICK_CLICK + 24;

const rowRect = (card: Card, i: number, scroll: number): Rect => ({ x: card.x + CARD_PAD - ROW_PAD, y: listTop(card) + i * ROW_H - scroll, w: card.w - 2 * CARD_PAD + 2 * ROW_PAD, h: ROW_H - ROW_GAP });

const pickRect = (card: Card) => rowRect(card, PICK, FINAL_SCROLL);

const cardPath = (card: Card): Waypoint[] => {
  const at = center(pickRect(card));

  return [
    { at: SCROLL_STEPS[0], x: at.x + 370, y: at.y + 306 },
    { at: SCROLL_STEPS[2] - 4, x: at.x + 110, y: at.y + 6 },
    { at: PICK_CLICK - 2, ...at },
    { at: PICK_CLICK + 1, ...at },
    { at: PLUGINS_FRAMES, x: at.x + 120, y: at.y + 150 },
  ];
};

const clicksIn = (card: Card): Click[] => [{ label: "install plugin", at: PICK_CLICK, path: cardPath(card), rect: pickRect(card) }];

export const PLUGINS_CLICKS: Click[] = clicksIn(LAYOUT[Format.Wide].card);

export const PLUGINS_TALL_CLICKS: Click[] = clicksIn(LAYOUT[Format.Tall].card);

export const PLUGINS_TALL_VIEW: Rect = LAYOUT[Format.Tall].card;

const WORD_TICKS = [0, 4, 8];

export const PLUGINS_CUES: Cue[] = [
  ...WORD_TICKS.map((at) => ({ at, sound: Sound.Tap, volume: 0.3 })),
  { at: WORD_IN, sound: Sound.Pop, volume: 0.55 },
  ...PLUGINS_CLICKS.map((c) => ({ at: c.at, sound: Sound.ClickB, volume: 0.6 })),
  { at: CARD_AT, sound: Sound.Whoosh, volume: 0.4 },
  ...assembleTicks(HEAD_AT).map((at) => ({ at, sound: Sound.Tap, volume: 0.12 })),
  { at: boxPopAt(HEAD_AT), sound: Sound.Pop, volume: 0.55, beat: true },
  ...SCROLL_STEPS.map((at) => ({ at, sound: Sound.Tap, volume: 0.25 })),
  { at: PICK_CLICK + 2, sound: Sound.Pop, volume: 0.5 },
];

const tileAt = (x: number, y: number, tile: { cols: number; rows: number }) => CARD_AT + ((x + y) / (tile.cols + tile.rows)) * TILE_SPAN + noise(x * 31 + y) * 4;

const InkTiles = () => {
  const frame = useCurrentFrame();
  const { tile } = LAYOUT[useStage().format];

  if (frame < CARD_AT) {
    return null;
  }

  return (
    <>
      {Array.from({ length: tile.cols * tile.rows }, (_, i) => {
        const x = i % tile.cols;
        const y = Math.floor(i / tile.cols);
        const flip = tween(frame, tileAt(x, y, tile), 6);

        return flip > 0 ? <div key={i} style={{ position: "absolute", left: x * TILE, top: y * TILE, width: TILE + 1, height: TILE + 1, background: INK, transform: `perspective(600px) rotateX(${(1 - flip) * 90}deg)` }} /> : null;
      })}
    </>
  );
};

const Word = () => {
  const frame = useCurrentFrame();
  const L = LAYOUT[useStage().format];
  const WORD_CELL = L.wordCell;
  const { cols, rows } = wordBlocks(WORD);
  const rise = lift(frame, WORD_OUT, 16) * WORD_RISE;

  if (frame > WORD_OUT + 20) {
    return null;
  }

  return (
    <div style={{ position: "absolute", left: (L.stage.width - cols * WORD_CELL) / 2, top: (L.stage.height - rows * WORD_CELL) / 2 - rise }}>
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

const Row = ({ listing, rect, card, hovered, installed }: { listing: Listing; rect: Rect; card: Card; hovered: boolean; installed: number }) => (
  <div style={{ position: "absolute", left: rect.x - card.x, top: rect.y - card.y, width: rect.w, height: rect.h, borderRadius: 22, background: hovered ? HOVER : "transparent", display: "flex", alignItems: "center", gap: 24, padding: "0 12px" }}>
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
  const L = LAYOUT[useStage().format];
  const CARD = L.card;
  const LIST_TOP = listTop(CARD);
  const path = cardPath(CARD);
  const enter = tween(frame, CARD_AT + 4, 14);
  const scroll = scrollAt(frame);
  const tip = pointerAt(frame, path);
  const cursorIn = frame >= SCROLL_STEPS[0];
  const installed = lift(frame, PICK_CLICK + 2, 8);

  if (frame < CARD_AT) {
    return null;
  }

  return (
    <>
      {frame >= HEAD_AT ? (
        <Place x={L.head.at.x} y={L.head.at.y} style={{ width: L.head.width }}>
          <Headline lines={L.head.lines} boxed="everything" tone={PLUGINS_TONE} size={L.head.size} align={L.head.align} start={HEAD_AT} />
        </Place>
      ) : null}
      <Place x={L.icons.x} y={L.icons.y} style={{ width: L.head.width, display: "flex", justifyContent: L.head.align === Align.Center ? "center" : "flex-start" }}>
        <IconRow sprites={["plug", "mesh", "cube", "type", "palette", "star"]} size={L.icons.size} start={HEAD_AT + 14} gap={L.icons.gap} stagger={3} />
      </Place>
      <div style={{ position: "absolute", left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: 44, background: PAPER, overflow: "hidden", transform: `translateX(${(1 - enter) * 1000}px) rotate(${(1 - enter) * 6}deg)` }}>
        <div style={{ position: "absolute", left: CARD_PAD + 12, top: 44, fontFamily: UI, fontSize: 24, fontWeight: 600, color: MUTED }}>Plugins</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: LIST_TOP - CARD.y - 16, maskImage: "linear-gradient(transparent, #000 40px, #000 calc(100% - 90px), transparent)" }}>
          <div style={{ position: "absolute", left: 0, top: CARD.y - LIST_TOP + 16 }}>
            {LISTINGS.map((listing, i) => {
              const rect = rowRect(CARD, i, scroll);
              const hovered = cursorIn && frame <= HOVER_UNTIL && inside(tip, rect);

              return <Row key={listing.name} listing={listing} rect={rect} card={CARD} hovered={hovered} installed={i === PICK ? installed : 0} />;
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
  const { stage } = LAYOUT[useStage().format];
  const landscapeOn = frame < CARD_AT + TILE_SPAN + 12;

  return (
    <Section tone={PLUGINS_TONE}>
      {landscapeOn ? (
        <div style={{ position: "absolute", inset: 0, transform: `scale(${1.08 - 0.08 * tween(frame, 0, 60)})` }}>
          <Landscape cols={stage.width / 10} rows={stage.height / 10} seed={7} width={stage.width} height={stage.height} />
        </div>
      ) : null}
      <Word />
      <InkTiles />
      <Catalogue />
    </Section>
  );
};
