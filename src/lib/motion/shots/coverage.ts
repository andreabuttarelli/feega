import type { VectorUi } from '../vector-ui/model';
import { DEVICE, ShotId } from './library';

export const FILL_MIN = 0.6;

type Frame = { width: number; height: number };
type Rect = { left: number; top: number; right: number; bottom: number };

const RAD = Math.PI / 180;
const EXPO = 1 - Math.pow(2, -10);
const BEZEL = 0.012;
const DEPTH = 1.3;
const SPLIT = { wide: 0.38, tall: 0.36 };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const span = (t: number, at: number, len: number) => clamp((t - at) / Math.max(0.001, len), 0, 1);
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const out = (p: number) => (p >= 1 ? 1 : (1 - Math.pow(2, -10 * p)) / EXPO);
const move = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2);

function share(r: Rect, f: Frame): number {
  const w = Math.max(0, Math.min(f.width, r.right) - Math.max(0, r.left));
  const h = Math.max(0, Math.min(f.height, r.bottom) - Math.max(0, r.top));
  return (w * h) / (f.width * f.height);
}

function deviceRect(ui: VectorUi, f: Frame, t: number, duration: number): Rect {
  const { width: W, height: H } = f;
  const wide = W >= H;
  const sw = W * (wide ? DEVICE.wide : DEVICE.tall);
  const sh = ui.height * (sw / ui.width);
  const bezel = Math.round(Math.min(W, H) * BEZEL);
  const zoomIn = wide ? 1 : Math.max(W / sw, H / sh);
  const p = out(span(t, 0.05, DEVICE.land));
  const after = span(t, DEVICE.land, Math.max(0.1, duration - DEVICE.land));
  const inside = move(span(t, DEVICE.land + DEVICE.hold, DEVICE.zoom));
  const ry = (mix(-104, 0, p) + 3 * after) * (1 - inside);
  const rx = (mix(30, 7, p) - 4 * after) * (1 - inside);
  const z = mix(-W * 0.9, 0, p);
  const y = mix(H * 0.22, 0, p);
  const k = (1 + 0.035 * after) * mix(1, zoomIn, inside);
  const near = (W * DEPTH) / (W * DEPTH - z);
  const sx = near * k * Math.max(0.04, Math.abs(Math.cos(ry * RAD)));
  const sy = near * k * Math.cos(rx * RAD);
  const tanY = Math.tan(-Math.sin(ry * RAD) * 10 * RAD);
  const tanX = Math.tan(-rx * 0.3 * RAD);
  const dw = sw / 2 + bezel;
  const dh = sh / 2 + bezel;
  const corners = [
    [-dw + bezel, -dh + bezel],
    [dw - bezel, -dh + bezel],
    [-dw + bezel, dh - bezel],
    [dw - bezel, dh - bezel]
  ].map(([x, yy]) => {
    const x1 = x + tanX * yy;
    const y1 = yy + tanY * x1;
    return [W / 2 + x1 * sx, H / 2 + y + y1 * sy];
  });
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function beforeAfter(ui: VectorUi, f: Frame, t: number): number {
  const wide = f.width >= f.height;
  const split = wide ? SPLIT.wide : SPLIT.tall;
  const long = wide ? f.width : f.height;
  const room = wide ? { w: f.width * (1 - split), h: f.height } : { w: f.width, h: f.height * (1 - split) };
  const k = Math.min((room.w * 0.92) / ui.width, (room.h * 0.8) / ui.height);
  const shown = (ui.width * k * ui.height * k) / (f.width * f.height);
  const edge = mix(long, long * split, move(span(t, 1.15, 0.9)));
  return shown * clamp((long - edge) / (long * (1 - split)), 0, 1);
}

const FILLED_CAMERA = () => 1;

const COVERAGE: Record<ShotId, ((ui: VectorUi, f: Frame, t: number, duration: number) => number) | null> = {
  [ShotId.DeviceFlyIn]: (ui, f, t, d) => share(deviceRect(ui, f, t, d), f),
  [ShotId.UiFocus]: FILLED_CAMERA,
  [ShotId.UiMorph]: FILLED_CAMERA,
  [ShotId.WhipZoom]: FILLED_CAMERA,
  [ShotId.BeforeAfter]: (ui, f, t) => beforeAfter(ui, f, t),
  [ShotId.KineticTitle]: null,
  [ShotId.FeatureGrid]: null,
  [ShotId.StatCount]: null,
  [ShotId.LogoResolve]: null,
  [ShotId.TaglineCard]: null
};

export const showsUi = (shot: ShotId) => COVERAGE[shot] !== null;

export function uiCoverage(shot: ShotId, ui: VectorUi, f: Frame, t: number, duration: number): number {
  return COVERAGE[shot]?.(ui, f, t, duration) ?? 0;
}
