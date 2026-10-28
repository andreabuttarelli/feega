const MB = 1024 * 1024;

export enum Device {
  Desktop = 'desktop',
  Phone = 'phone'
}

type Budget = { textureBytes: number; pictureSide: number; resolution: number };

export const BUDGET: Record<Device, Budget> = {
  [Device.Desktop]: { textureBytes: 256 * MB, pictureSide: 4096, resolution: 2 },
  [Device.Phone]: { textureBytes: 128 * MB, pictureSide: 2048, resolution: 2 }
};

const LOW_MEMORY_GB = 4;

const COARSE_POINTER = '(pointer: coarse)';

const touchFirst = () => (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || (typeof matchMedia === 'function' && matchMedia(COARSE_POINTER).matches);

type Traits = { touch: boolean; memoryGb?: number };

export const deviceOf = ({ touch, memoryGb }: Traits): Device => (touch || (memoryGb ?? Infinity) <= LOW_MEMORY_GB ? Device.Phone : Device.Desktop);

const memoryGb = () => (typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined);

export const currentDevice = (): Device => deviceOf({ touch: touchFirst(), memoryGb: memoryGb() });

const FLAT_LAYERS = '<style>*{will-change:auto!important}</style>';
const HEAD_END = '</head>';

const LAYER_PIXELS = 500_000_000;
const HINTED_CLIP = /class="[^"]*\b(fx|kf|ks)\b/g;

const layerPixels = (html: string, size: { width: number; height: number }) => (html.match(HINTED_CLIP)?.length ?? 0) * size.width * size.height;

export function previewHtml(html: string, size: { width: number; height: number }): string {
  if (layerPixels(html, size) <= LAYER_PIXELS) {
    return html;
  }
  const end = html.indexOf(HEAD_END);
  return end < 0 ? FLAT_LAYERS + html : html.slice(0, end) + FLAT_LAYERS + html.slice(end);
}
