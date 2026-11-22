import type { Rect } from "../editor/layout";

export const APP = { w: 1640, h: 980 };
export const BAR_H = 72;
export const LEFT_W = 380;
export const RIGHT_W = 420;
export const RIGHT_X = APP.w - RIGHT_W;
export const PAD = 28;

export const PAGE: Rect = { x: LEFT_W + PAD, y: BAR_H + PAD, w: RIGHT_X - LEFT_W - 2 * PAD, h: APP.h - BAR_H - PAD };
export const PAGE_PAD = 64;

export const HEAD_FONT = 76;
export const HEAD: Rect = { x: PAGE.x + PAGE_PAD - 12, y: PAGE.y + 132, w: 600, h: 2 * HEAD_FONT + 12 };
export const DROP: Rect = { x: PAGE.x + PAGE_PAD, y: HEAD.y + HEAD.h + 150, w: PAGE.w - 2 * PAGE_PAD, h: 300 };

export const PROPS_TOP = BAR_H + 128;
export const PROP_ROW = 76;
export const SWATCH = 52;
export const SWATCH_STEP = 66;
export const SWATCH_TOP = PROPS_TOP + 3 * PROP_ROW + 26;
export const swatchRect = (i: number): Rect => ({ x: RIGHT_X + PAD + i * SWATCH_STEP, y: SWATCH_TOP, w: SWATCH, h: SWATCH });

export const CARD_W = 152;
export const CARD_H = 138;
export const CARD_GAP = 20;
export const CARDS_TOP = BAR_H + 150;
export const cardRect = (i: number): Rect => ({ x: PAD + (i % 2) * (CARD_W + CARD_GAP), y: CARDS_TOP + Math.floor(i / 2) * (CARD_H + CARD_GAP), w: CARD_W, h: CARD_H });
