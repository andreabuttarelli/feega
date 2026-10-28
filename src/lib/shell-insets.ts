import { PANEL_WIDTHS } from '$lib/shell-nav';

export const RAIL_EDGE = '68px';
export const EDGE = '12px';

export const fitted = (px: number) => `min(${px}px, 100vw - 92px)`;

export function shellLeftOf(leftPanel: string | null | undefined): string {
  if (!leftPanel) {
    return EDGE;
  }

  return `calc(${RAIL_EDGE} + ${fitted(PANEL_WIDTHS[leftPanel] ?? PANEL_WIDTHS.assets)} + ${EDGE})`;
}
