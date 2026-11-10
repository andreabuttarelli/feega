// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { PropFormat } from '../custom/component';
import { SNAPCN_PORTS } from './catalog';
import { propsOf, snapcnSource, type SnapcnPort } from './model';

const PICTURE = 'https://x.supabase.co/storage/v1/object/sign/canvas-assets/org/proj/picture?token=abc';
const CLIP = 'https://x.supabase.co/storage/v1/object/sign/canvas-assets/org/proj/clip?token=abc';
const ITEMS = [{ src: CLIP, kind: 'video' }, { src: PICTURE, kind: 'image' }, { src: PICTURE, kind: 'image' }];

const RECT = { x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20, toJSON: () => ({}) };

beforeAll(() => {
  const pixels = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
  const pen = new Proxy({ getImageData: (_x: number, _y: number, w: number, h: number) => pixels(w, h), createImageData: pixels, measureText: (text: string) => ({ width: text.length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) }, { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => undefined), set: () => true });
  HTMLCanvasElement.prototype.getContext = (() => pen) as never;
  Object.defineProperty(document, 'fonts', { value: { status: 'loaded', ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true, addEventListener: () => undefined } });
  Object.assign(SVGElement.prototype, { getComputedTextLength: () => 100, getNumberOfChars: () => 4, getSubStringLength: () => 25, getStartPositionOfChar: () => ({ x: 0, y: 0 }), getExtentOfChar: () => RECT, getBBox: () => RECT });
  Object.assign(Range.prototype, { getBoundingClientRect: () => RECT, getClientRects: () => [RECT] });
});

type Update = { onUpdate: (this: { time: () => number }) => void };

function play(port: SnapcnPort, props: Record<string, unknown>) {
  const root = document.createElement('div');
  const updates: Update[] = [];
  const tl = { to: (_: unknown, vars: Update) => updates.push(vars) };
  const duration = port.frames / port.fps;
  new Function('root', 'props', 'tl', 'duration', 'fps', snapcnSource(port))(root, props, tl, duration, port.fps);
  for (const t of [0, duration / 3, duration / 2, duration - 1 / port.fps]) {
    updates.forEach((u) => u.onUpdate.call({ time: () => t }));
  }
  return root;
}

const defaults = (port: SnapcnPort) => Object.fromEntries(Object.entries(propsOf(port)).map(([key, spec]) => [key, spec.default]));

const FILL: Partial<Record<PropFormat, unknown>> = { [PropFormat.Asset]: PICTURE, [PropFormat.Media]: ITEMS };

const filled = (port: SnapcnPort) => Object.fromEntries(Object.entries(propsOf(port)).map(([key, spec]) => [key, (spec.format && FILL[spec.format]) ?? spec.default]));

const takesMedia = (port: SnapcnPort) => Object.values(port.props).some((spec) => spec.format === PropFormat.Media);

describe('every snapcn port plays from the source the player runs', () => {
  it.each(SNAPCN_PORTS.map((p) => [p.id, p]))('%s draws its frames with its defaults', (_, port) => {
    expect(play(port, defaults(port)).children.length).toBeGreaterThan(0);
  });

  it.each(SNAPCN_PORTS.map((p) => [p.id, p]))('%s draws its frames with every media field filled', (_, port) => {
    expect(play(port, filled(port)).children.length).toBeGreaterThan(0);
  });
});

describe('a picked clip plays as a video, whatever its url looks like', () => {
  const CLIP_PORTS = ['hero-launch', 'laptop-frame', 'phone-stack', 'reel-collage', 'reel-wall'];

  it.each(SNAPCN_PORTS.filter((p) => takesMedia(p) && CLIP_PORTS.includes(p.id)).map((p) => [p.id, p]))('%s', (_, port) => {
    const root = play(port, filled(port));
    expect([...root.querySelectorAll('video')].map((v) => v.getAttribute('src') ?? (v as HTMLVideoElement).src)).toContain(CLIP);
  });
});
