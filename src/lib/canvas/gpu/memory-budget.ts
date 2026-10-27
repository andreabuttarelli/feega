const MB = 1024 * 1024;

export enum Device {
  Desktop = 'desktop',
  Phone = 'phone'
}

type Budget = { textureBytes: number };

export const BUDGET: Record<Device, Budget> = {
  [Device.Desktop]: { textureBytes: 256 * MB },
  [Device.Phone]: { textureBytes: 128 * MB }
};

const COARSE_POINTER = '(pointer: coarse)';

const touchFirst = () => (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || (typeof matchMedia === 'function' && matchMedia(COARSE_POINTER).matches);

export const currentDevice = (): Device => (touchFirst() ? Device.Phone : Device.Desktop);

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
