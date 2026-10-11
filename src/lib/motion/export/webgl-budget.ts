export const WEBGL_CONTEXT_BUDGET = 16;
export const WEBGL_PAGE_CONTEXTS = 2;
export const WEBGL_META = 'feega-webgl';

const COUNTED = new RegExp(`<meta name="${WEBGL_META}" content="(\\d+)"`);

export const webglMeta = (contexts: number) => `<meta name="${WEBGL_META}" content="${contexts}" />`;

export function webglPerLane(html: string): number {
  return Number(COUNTED.exec(html)?.[1] ?? 0);
}

export function lanesWithin(wanted: number, perLane: number): number {
  if (perLane === 0) {
    return wanted;
  }
  return Math.max(1, Math.min(wanted, Math.floor((WEBGL_CONTEXT_BUDGET - WEBGL_PAGE_CONTEXTS) / perLane)));
}
