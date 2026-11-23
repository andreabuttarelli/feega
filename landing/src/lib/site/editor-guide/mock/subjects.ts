export enum Subject {
  Button = 'button',
  Image = 'image'
}

export enum Menu {
  None = 'none',
  State = 'state',
  Breakpoint = 'breakpoint'
}

export enum Anchor {
  Focus = 'focus',
  TopRight = 'top-right'
}

export enum Snap {
  Off = 'off',
  Demo = 'demo'
}

export const STATES = [
  { label: 'Default', styled: false },
  { label: 'Hover', styled: true },
  { label: 'Focus', styled: false },
  { label: 'Focus visible', styled: true },
  { label: 'Active', styled: false },
  { label: 'Disabled', styled: false }
] as const;

export const REACH = ['Follow the preview', 'All sizes', 'sm ≥ 640px', 'md ≥ 768px', 'lg ≥ 1024px', 'xl ≥ 1280px', '2xl ≥ 1536px'] as const;

export const REACH_BADGE = 'editing: auto · 880px';

export const THEME_STEPS_PX = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32] as const;
export const DRAG_PX_PER_STEP = 2;
export const TICK_HALF_WIDTH_PX = 70;
export const MARGIN_DRAFT_PX = 8;
export const PADDING_OFF_THEME_PX = 13;

export const ticksAround = (draft: number): readonly number[] =>
  THEME_STEPS_PX.map((step) => (step - draft) * DRAG_PX_PER_STEP).filter((offset) => Math.abs(offset) <= TICK_HALF_WIDTH_PX);

export const ATTRIBUTES = [
  { name: 'alt', value: 'Launch plan board', options: false },
  { name: 'fit', value: 'cover', options: true },
  { name: 'src', value: '/cover.svg', options: false }
] as const;

export const VARIABLES = [
  { name: 'tw ring offs…', value: '#ffffff' },
  { name: 'frame', value: '#3b82f6' }
] as const;
