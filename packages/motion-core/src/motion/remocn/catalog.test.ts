// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { customComponentSchema, MAX_JS, MAX_PROPS } from '../custom/component';
import { propsOf, snapcnComponent, snapcnSource, type SnapcnPort } from '../snapcn/model';
import { REMOCN_PORTS } from './catalog';

const ISOLATED_GLOBALS = ['root', 'props', 'tl', 'duration', 'fps'];
const RECT = { x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20, toJSON: () => ({}) };
const BRAND = /remocn/i;

beforeAll(() => {
  const pixels = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
  const pen = new Proxy({ getImageData: (_x: number, _y: number, w: number, h: number) => pixels(w, h), createImageData: pixels, measureText: (text: string) => ({ width: text.length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) }, { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => undefined), set: () => true });
  HTMLCanvasElement.prototype.getContext = (() => pen) as never;
  Object.defineProperty(document, 'fonts', { value: { status: 'loaded', ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true, addEventListener: () => undefined } });
  Object.assign(SVGElement.prototype, { getComputedTextLength: () => 100, getNumberOfChars: () => 4, getSubStringLength: () => 25, getStartPositionOfChar: () => ({ x: 0, y: 0 }), getExtentOfChar: () => RECT, getBBox: () => RECT });
  Object.assign(Range.prototype, { getBoundingClientRect: () => RECT, getClientRects: () => [RECT] });
});

type Update = { onUpdate: (this: { time: () => number }) => void };

function play(port: SnapcnPort) {
  const root = document.createElement('div');
  const updates: Update[] = [];
  const tl = { to: (_: unknown, vars: Update) => updates.push(vars) };
  const duration = port.frames / port.fps;
  const props = Object.fromEntries(Object.entries(propsOf(port)).map(([key, spec]) => [key, spec.default]));
  new Function('root', 'props', 'tl', 'duration', 'fps', snapcnSource(port))(root, props, tl, duration, port.fps);
  for (const t of [0, duration / 3, duration / 2, duration - 1 / port.fps]) {
    updates.forEach((u) => u.onUpdate.call({ time: () => t }));
  }
  return root;
}

const cases = REMOCN_PORTS.map((p) => [p.id, p] as const);

describe('remocn catalog', () => {
  it('lists every port once', () => {
    const ids = REMOCN_PORTS.map((p) => p.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(cases)('%s is a valid deterministic custom component', (_, port) => {
    const component = snapcnComponent(port);
    expect(customComponentSchema.safeParse(component).success).toBe(true);
    expect(component.source.js.length).toBeLessThan(MAX_JS);
    expect(Object.keys(component.propsSchema.properties).length).toBeLessThanOrEqual(MAX_PROPS);
  });

  it.each(cases)('%s source compiles with no reference outside its own scope', (_, port) => {
    expect(() => new Function(...ISOLATED_GLOBALS, snapcnSource(port))).not.toThrow();
    expect(snapcnSource(port)).not.toMatch(/__vite_ssr_import|__name\(|import\(/);
  });

  it.each(cases)('%s draws frames with its defaults and no empty picture', (_, port) => {
    const root = play(port);
    expect(root.children.length).toBeGreaterThan(0);
    expect([...root.querySelectorAll('img')].filter((img) => !img.getAttribute('src'))).toHaveLength(0);
  });

  it.each(cases)('%s shows the feega name, never the upstream one', (_, port) => {
    expect(play(port).textContent).not.toMatch(BRAND);
    expect(Object.values(propsOf(port)).map((s) => String(s.default))).not.toContain('remocn');
  });
});
