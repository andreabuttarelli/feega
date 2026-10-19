const MB = 1024 * 1024;

export enum Device {
  Desktop = 'desktop',
  Phone = 'phone'
}

type Budget = { textureBytes: number; decodeEdge: number; maxResolution: number; antialias: boolean; posterShelf: number; shootsSnapshots: boolean; layerHints: boolean };

export const BUDGET: Record<Device, Budget> = {
  [Device.Desktop]: { textureBytes: 256 * MB, decodeEdge: 2048, maxResolution: Infinity, antialias: true, posterShelf: 2, shootsSnapshots: true, layerHints: true },
  [Device.Phone]: { textureBytes: 128 * MB, decodeEdge: 512, maxResolution: 2, antialias: false, posterShelf: 0, shootsSnapshots: false, layerHints: false }
};

const COARSE_POINTER = '(pointer: coarse)';

const touchFirst = () => (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || (typeof matchMedia === 'function' && matchMedia(COARSE_POINTER).matches);

export const currentDevice = (): Device => (touchFirst() ? Device.Phone : Device.Desktop);

export const rendererResolution = (dpr: number, device: Device): number => Math.min(dpr, BUDGET[device].maxResolution);

export function decodeSize(width: number, height: number, device: Device): { width: number; height: number } {
  const scale = Math.min(1, BUDGET[device].decodeEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const FLAT_LAYERS = '<style>*{will-change:auto!important}</style>';
const HEAD_END = '</head>';

export function previewHtml(html: string, device: Device): string {
  if (BUDGET[device].layerHints) {
    return html;
  }
  const end = html.indexOf(HEAD_END);
  return end < 0 ? FLAT_LAYERS + html : html.slice(0, end) + FLAT_LAYERS + html.slice(end);
}
