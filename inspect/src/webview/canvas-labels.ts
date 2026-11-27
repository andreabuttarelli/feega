export const LABEL_PX = 12;
export const LABEL_MAX = 80;
export const LABEL_PAD_PX = 6;
export const LABEL_PAD_MAX = 20;
export const ROUTE_LABEL_RATIO = 1.15;
export const LABEL_LINE = 1.25;

export type LabelMetrics = { font: number; pad: number; routeBottom: number; sizeTop: number };

export function labelMetrics(scale: number, rowHead: number): LabelMetrics {
  const font = Math.min(LABEL_PX / scale, LABEL_MAX);
  const pad = Math.min(LABEL_PAD_PX / scale, LABEL_PAD_MAX);

  return { font, pad, routeBottom: font * ROUTE_LABEL_RATIO * LABEL_LINE, sizeTop: rowHead - pad - font * LABEL_LINE };
}
