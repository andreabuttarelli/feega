import { VECTOR_TOKEN } from '../vector-ui/piece';
import type { VectorUi } from '../vector-ui/model';
import { SHOT_NAMES } from '../shots/library';
import { UI_KIT, UI_SAFE, UiKind, UI_STRUCTURE, type UiPiece, type UiSize, type UiStructure } from './kit';

export type Rect = { x: number; y: number; w: number; h: number };
export type Anchors = Record<string, Rect>;
type Props = Record<string, unknown>;
type Layout = (p: Props) => Anchors;

enum Weight {
  Regular = 0.9,
  Bold = 1,
  Heavy = 1
}

const NARROW = /[iljtfr .,:;|!'()\[\]-]/;
const WIDE = /[mwMW@%]/;
const UPPER = /[A-Z]/;

const glyph = (c: string) => (NARROW.test(c) ? 0.28 : WIDE.test(c) ? 0.85 : UPPER.test(c) ? 0.66 : 0.58);

const NORMAL_LEADING = 1.2;

const textWidth = (text: string, px: number, weight: Weight) => [...String(text)].reduce((sum, c) => sum + glyph(c), 0) * px * weight;

function lines(text: string, px: number, weight: Weight, width: number): number {
  let count = 1;
  let used = 0;
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const w = textWidth(word + ' ', px, weight);
    if (used + w > width && used > 0) {
      count++;
      used = 0;
    }
    used += w;
  }
  return count;
}

const rows = (text: unknown) =>
  String(text ?? '')
    .split('\n')
    .map((r) => r.split('|').map((c) => c.trim()))
    .filter((r) => r[0]);

const str = (p: Props, k: string) => String(p[k] ?? '');

const SHORTENER: Layout = (p) => {
  const button = 72 + textWidth(str(p, 'button'), 26, Weight.Bold);
  return { field: { x: -590, y: -59, w: 1180 - 16 - button, h: 78 }, button: { x: 590 - button, y: -59, w: button, h: 76 } };
};

const SIDEBAR: Layout = (p) => Object.fromEntries(rows(p.items).map((_, i) => [`nav-${i}`, { x: -680, y: -308 + 58 * i, w: 300, h: 58 }]));

const HERO: Layout = (p) => {
  const headline = lines(str(p, 'headline'), 82, Weight.Heavy, 1220) * 82 * 1.05;
  const sub = lines(str(p, 'sub'), 28, Weight.Regular, 900) * 28 * NORMAL_LEADING + 26;
  const content = 74.4 + headline + sub + 114;
  const cta = 80 + textWidth(str(p, 'cta'), 26, Weight.Bold);
  return { cta: { x: -cta / 2, y: -340 + (680 - content) / 2 + content - 74, w: cta, h: 74 } };
};

const PROMPT_BOX: Layout = (p) => {
  const field = Math.max(130, lines(str(p, 'prompt'), 30, Weight.Regular, 1112) * 40.5) + 47;
  const height = 74 + 42.4 + field + 28 + 50;
  const top = -height / 2 + 1 + 36 + 42.4;
  const progress = top + field + 22;
  return {
    field: { x: -620, y: top, w: 1240, h: field },
    send: { x: 536.5, y: top + field - 83.5, w: 64, h: 64 },
    progress: { x: -620, y: progress, w: 1240, h: 6 },
    done: { x: -620, y: progress + 22, w: 46 + textWidth(str(p, 'done'), 24, Weight.Bold), h: 34 }
  };
};

const EDITOR_SLOTS = [[30, 30, 1300, 80], [30, 140, 760, 300], [820, 140, 510, 300], [30, 470, 640, 170], [700, 470, 630, 170]];

const EDITOR: Layout = (p) => Object.fromEntries(rows(p.blocks).slice(0, EDITOR_SLOTS.length).map((_, i) => {
  const [x, y, w, h] = EDITOR_SLOTS[i];
  return [`block-${i}`, { x: -680 + x, y: -309 + y, w: w + 2, h: h + 2 }];
}));

const CARD = { w: 461, h: 289, gap: 28, columns: 3 };

const CARD_GRID: Layout = (p) => {
  const cards = rows(p.cards).slice(0, 6);
  const lines = Math.ceil(cards.length / CARD.columns);
  const top = -(lines * CARD.h + (lines - 1) * CARD.gap) / 2;
  return Object.fromEntries(cards.map((_, i) => [`card-${i}`, { x: -720 + (i % CARD.columns) * ((1440 - CARD.gap * 2) / CARD.columns + CARD.gap), y: top + Math.floor(i / CARD.columns) * (CARD.h + CARD.gap), w: CARD.w, h: CARD.h }]));
};

const PRICING: Layout = (p) => {
  const plans = rows(p.plans).slice(0, 4);
  const features = Math.max(0, ...plans.map((r) => String(r[2] ?? '').split(';').filter((f) => f.trim()).length));
  const height = 2 + 72 + 31.2 + 14 + 81.6 + features * 39.2 + 14 + 63;
  const width = (1440 - 28 * (plans.length - 1)) / plans.length;
  return Object.fromEntries(plans.map((_, i) => [`buy-${i}`, { x: -720 + i * (width + 28) + 35, y: height / 2 - 101.7, w: width - 70, h: 63 }]));
};

const MODAL: Layout = (p) => {
  const y = -190 + 1 + 40 + 40.8 + 14 + lines(str(p, 'body'), 23, Weight.Regular, 700) * 32.2 + 34;
  const confirm = 59 + textWidth(str(p, 'confirm'), 22, Weight.Bold);
  const cancel = 59 + textWidth(str(p, 'cancel'), 22, Weight.Bold);
  return { confirm: { x: 391 - confirm, y, w: confirm, h: 60 }, cancel: { x: 391 - confirm - 14 - cancel, y, w: cancel, h: 60 } };
};

const TOGGLE: Layout = (p) => {
  const settings = rows(p.settings).slice(0, 6);
  return Object.fromEntries(settings.map((_, i) => [`toggle-${i}`, { x: 420, y: -125 + 85 * i + 42.5 * (4 - settings.length), w: 80, h: 44 }]));
};

const UPLOAD: Layout = () => ({ drop: { x: -550, y: -180, w: 1100, h: 224 } });

const RESULT = { left: -600, top: -230, picture: 460, gap: 34, copy: 706 };

const GENERATED_RESULT: Layout = () => ({
  picture: { x: RESULT.left, y: RESULT.top, w: RESULT.picture, h: RESULT.picture },
  copy: { x: RESULT.left + RESULT.picture + RESULT.gap, y: RESULT.top, w: RESULT.copy, h: RESULT.picture }
});

const NONE: Layout = () => ({});

const LAYOUTS: Record<UiKind, Layout> = {
  [UiKind.LinkShortener]: SHORTENER,
  [UiKind.LinkList]: NONE,
  [UiKind.StatCards]: NONE,
  [UiKind.Funnel]: NONE,
  [UiKind.Payouts]: NONE,
  [UiKind.Qr]: NONE,
  [UiKind.Window]: NONE,
  [UiKind.Sidebar]: SIDEBAR,
  [UiKind.Hero]: HERO,
  [UiKind.PromptBox]: PROMPT_BOX,
  [UiKind.EditorCanvas]: EDITOR,
  [UiKind.CardGrid]: CARD_GRID,
  [UiKind.Pricing]: PRICING,
  [UiKind.Chat]: NONE,
  [UiKind.Modal]: MODAL,
  [UiKind.Toggle]: TOGGLE,
  [UiKind.Upload]: UPLOAD,
  [UiKind.GeneratedResult]: GENERATED_RESULT,
  [UiKind.Cursor]: NONE
};

const BLOCK_HEIGHT: Record<UiStructure['blocks'][number]['kind'], (b: UiStructure['blocks'][number]) => number> = {
  nav: () => 0,
  heading: (b) => lines(b.text, 62, Weight.Heavy, 1272) * 62 * 1.05,
  text: (b) => lines(b.text, 26, Weight.Regular, 1272) * 26 * 1.4,
  input: () => 83,
  button: () => 72,
  stat: () => 54 * NORMAL_LEADING,
  card: () => 50 + 24 * NORMAL_LEADING + 14 + 46,
  list: (b) => 50 + 24 * NORMAL_LEADING + 14 + (b.items?.length ?? 0) * 59,
  picture: () => 200
};

const RECREATED_GAP = 26;

function recreatedAnchors(structure: UiStructure): Anchors {
  const anchors: Anchors = {};
  const nav = structure.blocks.some((b) => b.kind === 'nav');
  let y = -431 + 1 + (nav ? 77 : 0) + 44;
  const counts = new Map<string, number>();
  for (const block of structure.blocks.filter((b) => b.kind !== 'nav')) {
    const h = BLOCK_HEIGHT[block.kind](block);
    const n = counts.get(block.kind) ?? 0;
    counts.set(block.kind, n + 1);
    if (block.kind === 'button') {
      anchors.button = { x: -636, y, w: 80 + textWidth(block.text, 26, Weight.Bold), h };
    } else {
      anchors[`${block.kind}-${n}`] = { x: -636, y, w: 1272, h };
    }
    y += h + RECREATED_GAP;
  }
  return anchors;
}

const PIECE_KIND = new Map(Object.entries(UI_KIT).map(([kind, piece]) => [piece.name, kind as UiKind]));

const PARAM = /param\('(\w+)',\s*('(?:[^'\\]|\\.)*'|-?[\d.]+)/g;

export function defaultsOf(piece: Pick<UiPiece, 'js'>): Props {
  return Object.fromEntries([...piece.js.matchAll(PARAM)].map((m) => [m[1], m[2].startsWith("'") ? m[2].slice(1, -1).replace(/\\n/g, '\n').replace(/\\'/g, "'") : Number(m[2])]));
}

const STRUCTURE = /const S = (\{[\s\S]*?\});\n/;

export function structureOf(js: string): UiStructure | null {
  const found = STRUCTURE.exec(js);
  if (!found) {
    return null;
  }
  const parsed = UI_STRUCTURE.safeParse(JSON.parse(found[1]));
  return parsed.success ? parsed.data : null;
}

export type Placed = { size: UiSize; anchors: Anchors };

export function pieceAnchors(name: string, props: Props, js?: string): Placed | null {
  const kind = PIECE_KIND.get(name);
  if (kind) {
    const piece = UI_KIT[kind];
    return { size: piece.size, anchors: LAYOUTS[kind]({ ...defaultsOf(piece), ...props }) };
  }
  const vector = js && !SHOT_NAMES.has(name) ? vectorAnchors(js) : null;
  if (vector) {
    return vector;
  }
  const structure = js ? structureOf(js) : null;
  return structure ? { size: RECREATED_FRAME, anchors: recreatedAnchors(structure) } : null;
}

function vectorAnchors(js: string): Placed | null {
  const found = VECTOR_TOKEN.exec(js);
  if (!found) {
    return null;
  }
  const ui = JSON.parse(found[1]) as Pick<VectorUi, 'width' | 'height' | 'nodes'>;
  const anchors = Object.fromEntries(ui.nodes.map((n) => [n.id, { x: n.x - ui.width / 2, y: n.y - ui.height / 2, w: n.w, h: n.h }]));
  return { size: { width: ui.width, height: ui.height }, anchors };
}

const RECREATED_FRAME: UiSize = { width: 1400, height: 860 };

export function stageScale(size: UiSize, box: UiSize, zoom: number): number {
  return zoom * Math.min(1, (box.width * UI_SAFE) / size.width, (box.height * UI_SAFE) / size.height);
}
