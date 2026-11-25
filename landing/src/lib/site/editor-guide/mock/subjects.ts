export enum Anchor {
  Focus = 'focus',
  TopRight = 'top-right'
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
export const REACH_BADGE_MD = 'editing: md · 768px';

export const THEME_STEPS_PX = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32] as const;
export const DRAG_PX_PER_STEP = 2;
export const TICK_HALF_WIDTH_PX = 70;

export const ticksAround = (draft: number): readonly number[] =>
  THEME_STEPS_PX.map((step) => (step - draft) * DRAG_PX_PER_STEP).filter((offset) => Math.abs(offset) <= TICK_HALF_WIDTH_PX);
