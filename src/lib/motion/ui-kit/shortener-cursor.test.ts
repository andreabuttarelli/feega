// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { UI_KIT, UiKind } from './kit';

const FPS = 30;
const DURATION = 4;
const CURSOR_PX = 40;
const VIEWBOX = 24;
const TIP = { x: (4 / VIEWBOX) * CURSOR_PX, y: (2 / VIEWBOX) * CURSOR_PX };
const BUTTON = { left: 905, top: 82, width: 231, height: 76 };

type Box = typeof BUTTON;

function layOut(boxes: Record<string, Box>) {
  const read = (key: keyof Box) =>
    function (this: HTMLElement) {
      const box = boxes[this.className];
      return box ? box[key] : 0;
    };
  for (const [prop, key] of [['offsetLeft', 'left'], ['offsetTop', 'top'], ['offsetWidth', 'width'], ['offsetHeight', 'height']] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: read(key) });
  }
}

function mount(kind: UiKind) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  let update: (() => void) | null = null;
  let now = 0;
  const tl = { to: (_: unknown, o: { onUpdate: () => void }) => (update = o.onUpdate) };
  const param = (_: string, fallback: unknown) => fallback;
  new Function('root', 'param', 'tl', 'duration', 'rand', UI_KIT[kind].js)(root, param, tl, DURATION, () => 0.5);
  const seek = (t: number) => {
    now = t;
    update!.call({ time: () => now });
  };
  return { root, seek };
}

function tipAt(root: HTMLElement) {
  const cursor = root.querySelector('.cursor') as HTMLElement;
  return { x: parseFloat(cursor.style.left) + TIP.x, y: parseFloat(cursor.style.top) + TIP.y };
}

function pressed(root: HTMLElement) {
  const scale = /scale\(([\d.]+)\)/.exec((root.querySelector('.button') as HTMLElement).style.transform);
  return scale ? Number(scale[1]) < 1 : false;
}

const inside = (p: { x: number; y: number }, b: Box) => p.x >= b.left && p.x <= b.left + b.width && p.y >= b.top && p.y <= b.top + b.height;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the link shortener cursor', () => {
  it('clicks inside the button wherever the layout puts it, on every pressed frame', () => {
    for (const button of [BUTTON, { left: 700, top: 120, width: 180, height: 60 }]) {
      layOut({ button });
      const { root, seek } = mount(UiKind.LinkShortener);
      const frames = Array.from({ length: DURATION * FPS }, (_, i) => i / FPS);
      const presses = frames.filter((t) => {
        seek(t);
        return pressed(root);
      });

      expect(presses.length).toBeGreaterThan(0);
      for (const t of presses) {
        seek(t);
        expect(inside(tipAt(root), button), `t=${t}`).toBe(true);
      }
    }
  });

  it('arrives slowing down: still over the button the frame before the press', () => {
    layOut({ button: BUTTON });
    const { root, seek } = mount(UiKind.LinkShortener);
    const frames = Array.from({ length: DURATION * FPS }, (_, i) => i / FPS);
    const first = frames.find((t) => {
      seek(t);
      return pressed(root);
    })!;
    seek(first - 2 / FPS);
    const before = tipAt(root);
    seek(first - 1 / FPS);
    const last = tipAt(root);

    expect(Math.hypot(last.x - before.x, last.y - before.y)).toBeLessThan(4);
    expect(inside(last, BUTTON)).toBe(true);
  });
});
