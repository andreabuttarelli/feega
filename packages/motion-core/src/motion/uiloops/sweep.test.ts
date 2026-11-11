// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { UI_LOOP_PORTS } from './catalog';
import { defaultsOf, playAt } from './play';

beforeAll(() => {
  const pixels = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
  const pen = new Proxy({ getImageData: (_x: number, _y: number, w: number, h: number) => pixels(w, h), measureText: (text: string) => ({ width: text.length * 10 }) }, { get: (t, k) => (k in t ? (t as never)[k] : () => undefined), set: () => true });
  HTMLCanvasElement.prototype.getContext = (() => pen) as never;
});

describe('every ui loop plays from the source the player runs', () => {
  it.each(UI_LOOP_PORTS.map((p) => [p.id, p]))('%s draws its frames with its defaults', (_, port) => {
    const last = port.frames - 1;
    const root = playAt(port, defaultsOf(port), [0, Math.round(last / 3), Math.round(last / 2), last]);
    expect(root.children.length).toBeGreaterThan(0);
    expect(root.innerHTML).not.toMatch(/NaN|undefined/);
  });

});
