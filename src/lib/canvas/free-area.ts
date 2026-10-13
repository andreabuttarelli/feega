type Box = { left: number; top: number; right: number; bottom: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

export const PANEL_ATTR = 'data-panel';

const occupies = (b: Box) => b.right > b.left && b.bottom > b.top;

export function freeArea(screen: { width: number; height: number }, panels: readonly Box[]): Insets {
  const shown = panels.filter(occupies);
  const bands = shown.filter((b) => b.bottom - b.top <= screen.height / 2);
  const columns = shown.filter((b) => b.bottom - b.top > screen.height / 2);
  const above = (b: Box) => b.top + b.bottom < screen.height;
  const leftOf = (b: Box) => b.left + b.right < screen.width;

  return {
    top: Math.max(0, ...bands.filter(above).map((b) => b.bottom)),
    right: Math.max(0, ...columns.filter((b) => !leftOf(b)).map((b) => screen.width - b.left)),
    bottom: Math.max(0, ...bands.filter((b) => !above(b)).map((b) => screen.height - b.top)),
    left: Math.max(0, ...columns.filter(leftOf).map((b) => b.right))
  };
}

const MARGIN_PX = 32;

type Px = `${number}px`;
export type FitPadding = { top: Px; right: Px; bottom: Px; left: Px };
export type FocusRequest = { ids: string[]; key: number; padding?: FitPadding };

const px = (n: number): Px => `${Math.round(n + MARGIN_PX)}px`;

export const fitPadding = (free: Insets): FitPadding => ({ top: px(free.top), right: px(free.right), bottom: px(free.bottom), left: px(free.left) });
