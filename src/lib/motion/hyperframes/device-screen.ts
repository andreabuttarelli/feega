import { DEVICE, Cutout, SCREEN, type Device, type DeviceSpec } from '../devices';
import { facesOf, screenHostId } from '../device-screen';
import { boxOf, type Box } from '../layout';
import { css } from './html';
import { sliceChunks } from './ring';
import { screenPlacement } from './three-draw';
import { DEVICE_OVERSCAN, overscanned } from './templates';

export const SCREEN_RASTER = { oversample: 2, maxSide: 4096 };

type Size = { width: number; height: number };
export type ScreenFace = { w: number; h: number };
export type ScreenBake = { faces: ScreenFace[]; stage: Box };

export type ScreenInput = {
  id: string;
  frame: Size;
  place: { x: number; y: number; width: number; height: number };
  device: Device;
  fit: string;
  zoomMax: number;
  compFrame: Size;
};

const round = (n: number) => Math.round(n * 100) / 100;
const pxOf = (n: number) => `${round(n)}px`;

function screenSize(input: ScreenInput): Size {
  const box = boxOf(input.place, input.frame);
  const [pw, ph] = SCREEN[input.device].px;
  const long = Math.min(SCREEN_RASTER.maxSide, Math.ceil(SCREEN_RASTER.oversample * Math.max(box.width, box.height) * input.zoomMax));
  const scale = long / Math.max(pw, ph);
  return { width: pw * scale, height: ph * scale };
}

export function screenBake(input: ScreenInput): ScreenBake {
  const size = screenSize(input);
  const faces = facesOf(input.device);
  return {
    faces: Array.from({ length: faces }, () => ({ w: round(size.width / faces), h: round(size.height) })),
    stage: overscanned(boxOf(input.place, input.frame), DEVICE_OVERSCAN)
  };
}

type Scale = { kx: number; ky: number };

const pill = (spec: DeviceSpec, k: Scale, radius: (h: number) => string) => {
  const c = spec.cutout;
  const width = c.width * k.kx;
  const height = c.height * k.ky;
  return css({ position: 'absolute', left: pxOf((spec.screen.width * k.kx - width) / 2), top: pxOf(c.top * k.ky), width: pxOf(width), height: pxOf(height), background: '#000', borderRadius: radius(height) });
};

const CUTOUT_HTML: Record<Cutout, (spec: DeviceSpec, k: Scale) => string> = {
  [Cutout.None]: () => '',
  [Cutout.Island]: (spec, k) => `<div style="${pill(spec, k, (h) => pxOf(h / 2))}"></div>`,
  [Cutout.Punch]: (spec, k) => `<div style="${pill(spec, k, () => '50%')}"></div>`,
  [Cutout.Notch]: (spec, k) => `<div style="${pill(spec, k, (h) => `0 0 ${pxOf(h / 3)} ${pxOf(h / 3)}`)}"></div>`
};

function corners(radius: number, face: number, faces: number): string {
  const r = pxOf(radius);
  const SPLIT = [`${r} 0 0 ${r}`, `0 ${r} ${r} 0`];
  return faces === 1 ? r : SPLIT[face];
}

const FLAT = '<style>.dsf *{will-change:auto!important}</style>';

export function screenHtml(input: ScreenInput, content: string): string {
  const spec = DEVICE[input.device];
  const size = screenSize(input);
  const faces = facesOf(input.device);
  const faceWidth = size.width / faces;
  const k = { kx: size.width / spec.screen.width, ky: size.height / spec.screen.height };
  const fit = screenPlacement(input.compFrame, size, input.fit, 0, SCREEN[input.device].safeTop);
  const scale = fit.dw / fit.sw;
  const ids = Array.from({ length: faces }, (_, face) => screenHostId(input.id, face));
  const chunks = sliceChunks(content, ids);

  const face = (id: string, index: number) => {
    const box = css({ position: 'absolute', left: '0', top: '0', width: pxOf(faceWidth), height: pxOf(size.height), transformOrigin: '0 0', overflow: 'hidden', background: '#000', borderRadius: corners(spec.screen.radius * k.kx, index, faces), visibility: 'hidden' });
    const offset = { x: fit.dx - fit.sx * scale - index * faceWidth, y: fit.dy - fit.sy * scale };
    const inner = css({ position: 'absolute', left: '0', top: '0', width: pxOf(input.compFrame.width), height: pxOf(input.compFrame.height), transformOrigin: '0 0', transform: `translate(${pxOf(offset.x)},${pxOf(offset.y)}) scale(${round(scale * 10000) / 10000})` });
    const cutout = faces === 1 ? CUTOUT_HTML[spec.cutout.kind](spec, k) : '';
    return `<div id="dsf-${input.id}-${index}" class="dsf" style="${box}"><div class="dsc" style="${inner}">${chunks.get(id) ?? ''}</div>${cutout}</div><!--/screen-->`;
  };

  return FLAT + ids.map(face).join('');
}
