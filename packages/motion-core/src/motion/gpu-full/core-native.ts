import { rasterOf, type Attached, type CoreRaster } from './core-web';
import { Outcome } from './core-outcome';

export type NativePlacement = { x: number; y: number; width: number; height: number };
export type NativeCamera = { x: number; y: number; zoom: number };
export type Rgb = [number, number, number];

export type NativeCanvasBridge = {
  attach: (placement: NativePlacement, width: number, height: number, background: Rgb) => Promise<void>;
  picture: (clip: string, rgba: ArrayBuffer, width: number, height: number) => void;
  putGroup: (key: string, json: string) => void;
  appendGroup: (key: string, json: string) => void;
  patchGroup: (from: string, to: string, json: string) => void;
  dropGroup: (key: string) => void;
  patchUses: (json: string) => void;
  setOverlay: (json: string) => void;
  tick: (camera: NativeCamera | null) => void;
  place: (placement: NativePlacement) => void;
  report: () => string;
  stats: () => Promise<string | null>;
  close: () => void;
};

type ToRgba = (source: unknown, width: number, height: number) => ArrayBuffer;
type Told = { report: string; pending: boolean; cacheBytes: number };

const HOLE_ATTRIBUTE = 'data-native-hole';
const HOLE_STYLE_ATTRIBUTE = 'data-native-canvas';
const HOLE_STYLE = `[${HOLE_ATTRIBUTE}] { background-color: transparent !important; }`;
const WHITE: Rgb = [1, 1, 1];
const COLOUR_CHANNELS = 255;
const OPAQUE_ENOUGH = 0.99;
const NOTHING_YET: Told = { report: Outcome.Idle, pending: false, cacheBytes: 0 };

function told(raw: string): Told {
  if (!raw) {
    return NOTHING_YET;
  }
  return { ...NOTHING_YET, ...(JSON.parse(raw) as Partial<Told>) };
}

const sameCamera = (a: NativeCamera | null, b: NativeCamera) => a !== null && a.x === b.x && a.y === b.y && a.zoom === b.zoom;

export function attachedOf(bridge: NativeCanvasBridge, toRgba: ToRgba): Attached {
  const known = new Set<string>();
  let wanted: NativeCamera | null = null;
  let sent: NativeCamera | null = null;
  const overlay = { fixed: [] as unknown[], live: [] as unknown[] };
  const sendOverlay = () => bridge.setOverlay(JSON.stringify([...overlay.fixed, ...overlay.live]));

  return {
    draw: () => {
      throw new Error('the native canvas has no one-shot draw; that is the exporter');
    },
    set_camera: (x, y, zoom) => {
      wanted = { x, y, zoom };
    },
    patch_uses: (patch) => bridge.patchUses(patch),
    set_overlay: (items) => {
      overlay.fixed = JSON.parse(items);
      sendOverlay();
    },
    set_live_overlay: (items) => {
      overlay.live = JSON.parse(items);
      sendOverlay();
    },
    forget_picture: () => {},
    picture_bytes: () => 0,
    lost: () => false,
    frame: () => {
      const moved = wanted !== null && !sameCamera(sent, wanted);
      bridge.tick(moved ? wanted : null);
      sent = moved ? wanted : sent;
      return told(bridge.report()).report;
    },
    picture: (clip, source, width, height) => bridge.picture(clip, toRgba(source, width, height), width, height),
    put_group: (key, list) => {
      known.add(key);
      bridge.putGroup(key, list);
    },
    append_group: (key, list) => {
      known.add(key);
      bridge.appendGroup(key, list);
    },
    patch_group: (from, to, splice) => {
      if (!known.has(from)) {
        return false;
      }
      known.add(to);
      bridge.patchGroup(from, to, splice);
      return true;
    },
    drop_group: (key) => {
      known.delete(key);
      bridge.dropGroup(key);
    },
    cache_pending: () => told(bridge.report()).pending,
    cache_bytes: () => told(bridge.report()).cacheBytes,
    free: () => bridge.close()
  };
}

function rgbaOfBrowser(source: unknown, width: number, height: number): ArrayBuffer {
  const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
  const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  context.drawImage(source as CanvasImageSource, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data.buffer as ArrayBuffer;
}

function ancestors(element: Element): Element[] {
  const chain: Element[] = [];
  for (let at: Element | null = element; at; at = at.parentElement) {
    chain.push(at);
  }
  return chain;
}

export function backgroundOf(canvas: Element): Rgb {
  for (const element of ancestors(canvas)) {
    const [red, green, blue, alpha = 1] = (getComputedStyle(element).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
    if (alpha >= OPAQUE_ENOUGH && red !== undefined) {
      return [red / COLOUR_CHANNELS, green / COLOUR_CHANNELS, blue / COLOUR_CHANNELS];
    }
  }
  return WHITE;
}

export function openHole(canvas: Element): () => void {
  const chain = ancestors(canvas);
  const style = Object.assign(document.createElement('style'), { textContent: HOLE_STYLE });
  style.setAttribute(HOLE_STYLE_ATTRIBUTE, '');
  document.head.append(style);
  chain.forEach((element) => element.setAttribute(HOLE_ATTRIBUTE, ''));
  return () => {
    chain.forEach((element) => element.removeAttribute(HOLE_ATTRIBUTE));
    style.remove();
  };
}

const placementOf = (canvas: Element): NativePlacement => {
  const { left, top, width, height } = canvas.getBoundingClientRect();
  return { x: left, y: top, width, height };
};

const samePlacement = (a: NativePlacement, b: NativePlacement) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

function follow(canvas: Element, start: NativePlacement, move: (to: NativePlacement) => void): () => void {
  let last = start;
  let frame = requestAnimationFrame(function check() {
    const now = placementOf(canvas);
    if (!samePlacement(now, last)) {
      last = now;
      move(now);
    }
    frame = requestAnimationFrame(check);
  });
  return () => cancelAnimationFrame(frame);
}

const bridgeOf = (): NativeCanvasBridge | null => (typeof window === 'undefined' ? null : ((window as { feegaNativeCanvas?: NativeCanvasBridge }).feegaNativeCanvas ?? null));

export const nativeCanvasOffered = (): boolean => bridgeOf() !== null;

export async function createCoreNative(canvas: HTMLCanvasElement, width: number, height: number): Promise<CoreRaster> {
  const bridge = bridgeOf();
  if (!bridge) {
    throw new Error('native canvas unavailable');
  }
  const placement = placementOf(canvas);
  await bridge.attach(placement, width, height, backgroundOf(canvas));
  const closeHole = openHole(canvas);
  const stopFollowing = follow(canvas, placement, bridge.place);
  const raster = rasterOf(attachedOf(bridge, rgbaOfBrowser));
  return {
    ...raster,
    behindPage: true,
    dispose: () => {
      stopFollowing();
      closeHole();
      raster.dispose();
    }
  };
}
