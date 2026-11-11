// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { propsOf, snapcnSource } from '../snapcn/model';
import { RENDERCOMP_PORTS } from './catalog';
import type { RendercompPort } from './model';

const RECT = { x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20, toJSON: () => ({}) };
const SAMPLE_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

beforeAll(() => {
  const pixels = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
  const pen = new Proxy({ getImageData: (_x: number, _y: number, w: number, h: number) => pixels(w, h), createImageData: pixels, measureText: (text: string) => ({ width: text.length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) }, { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => undefined), set: () => true });
  HTMLCanvasElement.prototype.getContext = (() => pen) as never;
  Object.defineProperty(document, 'fonts', { value: { status: 'loaded', ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true, addEventListener: () => undefined } });
  Object.assign(SVGElement.prototype, { getComputedTextLength: () => 100, getNumberOfChars: () => 4, getSubStringLength: () => 25, getStartPositionOfChar: () => ({ x: 0, y: 0 }), getExtentOfChar: () => RECT, getBBox: () => RECT, getTotalLength: () => 100, getPointAtLength: () => ({ x: 0, y: 0 }) });
  Object.assign(Range.prototype, { getBoundingClientRect: () => RECT, getClientRects: () => [RECT] });
});

type Update = { onUpdate: (this: { time: () => number }) => void };

function play(port: RendercompPort, props: Record<string, unknown>): string[] {
  const root = document.createElement('div');
  const updates: Update[] = [];
  const tl = { to: (_: unknown, vars: Update) => updates.push(vars) };
  const duration = port.frames / port.fps;
  new Function('root', 'props', 'tl', 'duration', 'fps', snapcnSource(port))(root, props, tl, duration, port.fps);
  return SAMPLE_FRACTIONS.map((fraction) => {
    updates.forEach((u) => u.onUpdate.call({ time: () => Math.min(duration - 1 / port.fps, fraction * duration) }));
    return root.innerHTML;
  });
}

const defaults = (port: RendercompPort) => Object.fromEntries(Object.entries(propsOf(port)).map(([key, spec]) => [key, spec.default]));

const SNAPSHOT_DECIMALS = 4;
const LONG_DECIMAL = /-?\d+\.\d{7,}/g;
const platformStable = (frames: string[]) => frames.map((html) => html.replace(LONG_DECIMAL, (n) => String(Number(Number(n).toFixed(SNAPSHOT_DECIMALS)))));

const PORTS = RENDERCOMP_PORTS.map((p) => [p.id, p] as const);

describe('every rendercomp port plays from the source the player runs', () => {
  it.each(PORTS)('%s draws something at every sampled frame', (_, port) => {
    expect(play(port, defaults(port)).every((html) => html.length > 0)).toBe(true);
  });

  it.each(PORTS)('%s draws the same frames twice', (_, port) => {
    expect(play(port, defaults(port))).toEqual(play(port, defaults(port)));
  });

  it.each(PORTS)('%s keeps its frames at fixed samples', (_, port) => {
    expect(platformStable(play(port, defaults(port)))).toMatchSnapshot();
  });

  it.each(PORTS)('%s marks its canvas on every frame so the stage re-reads it', (_, port) => {
    const canvases = play(port, defaults(port)).map((html) => html.match(/<canvas[^>]*>/)?.[0]);

    if (canvases[0]) {
      expect(new Set(canvases).size).toBe(canvases.length);
    }
  });

  it.each(PORTS)('%s draws no empty picture', (_, port) => {
    const root = document.createElement('div');
    root.innerHTML = play(port, defaults(port)).join('');
    expect([...root.querySelectorAll('img')].filter((img) => !img.getAttribute('src'))).toHaveLength(0);
  });
});
