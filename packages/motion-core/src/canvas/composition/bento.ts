import { clampParams } from './clamp';
import type { LayoutParam, LayoutParams, Transform } from './types';

export enum BentoEnter {
  None = 'none',
  Rise = 'rise',
  Fade = 'fade',
  Scale = 'scale'
}

export const BENTO_REFERENCE_SIDE = 1080;
export const BENTO_GRID = { min: 1, max: 4 } as const;

export const BENTO_DEFAULTS = {
  columns: 3,
  rows: 2,
  gap: 24,
  radius: 24,
  cellColor: '#1c1c1c',
  enter: BentoEnter.Rise,
  stagger: 0.12,
  enterSeconds: 0.6
} as const;

export const BENTO_RADIUS = { label: 'Corner radius', min: 0, max: 200, step: 1, fallback: BENTO_DEFAULTS.radius } as const;

export const params: LayoutParam[] = [
  { name: 'columns', label: 'Columns', kind: 'range', min: BENTO_GRID.min, max: BENTO_GRID.max, step: 1, default: BENTO_DEFAULTS.columns },
  { name: 'rows', label: 'Rows', kind: 'range', min: BENTO_GRID.min, max: BENTO_GRID.max, step: 1, default: BENTO_DEFAULTS.rows },
  { name: 'gap', label: 'Gap (px at 1080p)', kind: 'range', min: 0, max: 160, step: 1, default: BENTO_DEFAULTS.gap },
  { name: 'cornerRadius', label: BENTO_RADIUS.label, kind: 'range', min: BENTO_RADIUS.min, max: BENTO_RADIUS.max, step: BENTO_RADIUS.step, default: BENTO_RADIUS.fallback },
  { name: 'cellColor', label: 'Cell colour', kind: 'color', default: BENTO_DEFAULTS.cellColor },
  {
    name: 'enter',
    label: 'Entrance',
    kind: 'select',
    options: [
      { value: BentoEnter.None, label: 'None' },
      { value: BentoEnter.Rise, label: 'Rise' },
      { value: BentoEnter.Fade, label: 'Fade' },
      { value: BentoEnter.Scale, label: 'Scale' }
    ],
    default: BENTO_DEFAULTS.enter
  },
  { name: 'stagger', label: 'Cascade delay (s)', kind: 'range', min: 0, max: 1, step: 0.01, default: BENTO_DEFAULTS.stagger },
  { name: 'enterSeconds', label: 'Entrance length (s)', kind: 'range', min: 0.1, max: 2, step: 0.05, default: BENTO_DEFAULTS.enterSeconds }
];

export type BentoGrid = { columns: number; rows: number; gap: number };
export type BentoSpan = { columns?: number; rows?: number };
export type BentoRect = { left: number; top: number; width: number; height: number };
export type BentoCell = { item: number | null; rect: BentoRect };
type Frame = { width: number; height: number };
type Slot = { column: number; row: number; columns: number; rows: number };

export function bentoPx(px: number, frame: Frame): number {
  return (px * Math.min(frame.width, frame.height)) / BENTO_REFERENCE_SIDE;
}

const spanOf = (value: number | undefined, limit: number) => Math.min(limit, Math.max(1, Math.round(value ?? 1)));

function fits(taken: boolean[][], slot: Slot): boolean {
  for (let r = slot.row; r < slot.row + slot.rows; r++) {
    for (let c = slot.column; c < slot.column + slot.columns; c++) {
      if (taken[r]?.[c] !== false) {
        return false;
      }
    }
  }
  return true;
}

function take(taken: boolean[][], slot: Slot): void {
  for (let r = slot.row; r < slot.row + slot.rows; r++) {
    for (let c = slot.column; c < slot.column + slot.columns; c++) {
      taken[r][c] = true;
    }
  }
}

function firstFree(taken: boolean[][], grid: BentoGrid, size: { columns: number; rows: number }): Slot | null {
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const slot = { column, row, ...size };
      if (fits(taken, slot)) {
        return slot;
      }
    }
  }
  return null;
}

function placements(grid: BentoGrid, spans: readonly BentoSpan[]): { item: number | null; slot: Slot }[] {
  const taken = Array.from({ length: grid.rows }, () => Array<boolean>(grid.columns).fill(false));
  const placed: { item: number | null; slot: Slot }[] = [];

  spans.forEach((span, item) => {
    const slot = firstFree(taken, grid, { columns: spanOf(span.columns, grid.columns), rows: spanOf(span.rows, grid.rows) });
    if (!slot) {
      return;
    }
    take(taken, slot);
    placed.push({ item, slot });
  });

  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      if (!taken[row][column]) {
        placed.push({ item: null, slot: { column, row, columns: 1, rows: 1 } });
      }
    }
  }
  return placed;
}

export function bentoCells(grid: BentoGrid, spans: readonly BentoSpan[], frame: Frame): BentoCell[] {
  const { gap } = grid;
  const unitW = (frame.width - gap * (grid.columns + 1)) / grid.columns;
  const unitH = (frame.height - gap * (grid.rows + 1)) / grid.rows;

  return placements(grid, spans).map(({ item, slot }) => ({
    item,
    rect: {
      left: gap + slot.column * (unitW + gap),
      top: gap + slot.row * (unitH + gap),
      width: slot.columns * unitW + (slot.columns - 1) * gap,
      height: slot.rows * unitH + (slot.rows - 1) * gap
    }
  }));
}

export function bentoGrid(raw: LayoutParams, frame: Frame): BentoGrid {
  const v = clampParams(params, raw);
  return { columns: Math.round(Number(v.columns)), rows: Math.round(Number(v.rows)), gap: bentoPx(Number(v.gap), frame) };
}

const FLAT_FRAME = { width: 2, height: 2 };
const CARD_WORLD = 1;

export function transforms(count: number, raw: LayoutParams): Transform[] {
  const cells = bentoCells(bentoGrid(raw, FLAT_FRAME), Array(count).fill({}), FLAT_FRAME).filter((c) => c.item !== null);
  return cells.map(({ rect }) => ({
    position: { x: rect.left + rect.width / 2 - CARD_WORLD, y: CARD_WORLD - rect.top - rect.height / 2, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: rect.width, y: rect.height, z: 1 },
    opacity: 1
  }));
}
