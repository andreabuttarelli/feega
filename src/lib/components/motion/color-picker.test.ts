// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import ColorPicker from './ColorPicker.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

let app: Record<string, unknown> | null = null;
let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  Element.prototype.setPointerCapture = () => {};
});

afterEach(() => {
  if (app) {
    unmount(app);
    app = null;
  }
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function show(props: Record<string, unknown> = {}) {
  const onchange = vi.fn();
  const gesture = { begin: vi.fn(), release: vi.fn(), cancel: vi.fn() };
  app = mount(ColorPicker, { target: document.body, props: { value: '#ff0000', tokens: FEEGA_TOKENS, alpha: 1, gesture, onchange, ...props } });
  flushSync();
  return { onchange, gesture };
}

const byId = <T extends HTMLElement>(id: string) => document.querySelector<T>(`[data-testid="${id}"]`)!;
const channels = () => [...document.querySelectorAll<HTMLInputElement>('[data-testid="colour-channel"]')];

function pointer(el: Element, type: string, x: number, y: number) {
  const e = new Event(type, { bubbles: true }) as Event & { clientX: number; clientY: number; pointerId: number };
  Object.assign(e, { clientX: x, clientY: y, pointerId: 1 });
  el.dispatchEvent(e);
}

function sized(el: HTMLElement) {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
}

describe('colour picker', () => {
  it('shows the saturation square and both sliders at once', () => {
    show();

    expect(byId('colour-square')).not.toBeNull();
    expect(byId('colour-hue')).not.toBeNull();
    expect(byId('colour-alpha')).not.toBeNull();
  });

  it('has no opacity controls where the caller stores no alpha', () => {
    show({ alpha: null });

    expect(byId('colour-alpha')).toBeNull();
    expect(byId('colour-opacity')).toBeNull();
  });

  it('hides the eyedropper where the browser has none', () => {
    show();

    expect(byId('colour-eyedropper')).toBeNull();
  });

  it('switches the value fields with the format: one for hex, three for the rest', () => {
    show({ value: '#336699' });
    const format = byId<HTMLSelectElement>('colour-format');

    expect(channels().map((c) => c.value)).toEqual(['336699']);
    for (const [name, values] of [['rgb', ['51', '102', '153']], ['hsl', ['210', '50', '40']], ['hsb', ['210', '67', '60']]] as const) {
      format.value = name;
      format.dispatchEvent(new Event('change', { bubbles: true }));
      flushSync();
      expect(channels().map((c) => c.value)).toEqual(values);
    }
  });

  it('one drag on the square is one gesture and at most one change per frame', () => {
    const { onchange, gesture } = show();
    const square = byId('colour-square');
    sized(square);

    pointer(square, 'pointerdown', 0, 0);
    pointer(square, 'pointermove', 50, 50);
    pointer(square, 'pointermove', 100, 100);

    expect(gesture.begin).toHaveBeenCalledTimes(1);
    expect(onchange).not.toHaveBeenCalled();
    frames.forEach((cb) => cb(0));
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange.mock.calls[0][0]).toBe('#000000');

    pointer(square, 'pointerup', 100, 100);
    expect(gesture.release).toHaveBeenCalledTimes(1);
  });

  it('the square thumb follows the pointer while the value prop is held', () => {
    show();
    const square = byId('colour-square');
    sized(square);
    const thumb = () => square.querySelector<HTMLElement>('.thumb')!.style.left;

    pointer(square, 'pointerdown', 0, 0);
    pointer(square, 'pointermove', 50, 50);
    frames.forEach((cb) => cb(0));
    flushSync();

    expect(thumb()).toBe('50%');
  });

  it('the hue and opacity thumbs follow the pointer while the value prop is held', () => {
    show();
    const hue = byId('colour-hue');
    const alpha = byId('colour-alpha');
    sized(hue);
    sized(alpha);

    pointer(hue, 'pointerdown', 25, 0);
    frames.forEach((cb) => cb(0));
    flushSync();
    pointer(alpha, 'pointerdown', 40, 0);
    frames.forEach((cb) => cb(0));
    flushSync();

    expect(hue.querySelector<HTMLElement>('.thumb')!.style.left).toBe('25%');
    expect(alpha.querySelector<HTMLElement>('.thumb')!.style.left).toBe('40%');
  });

  it('arrows nudge saturation and brightness, shift by ten', () => {
    const { onchange } = show({ value: '#808080' });
    const square = byId('colour-square');

    square.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));

    expect(onchange.mock.calls.at(-1)![0]).toBe('#807373');
  });

  it('arrows nudge the opacity field in percent', () => {
    const { onchange } = show({ alpha: 0.5 });

    byId('colour-opacity').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(onchange).toHaveBeenCalledWith('#ff0000', 0.51);
  });

  it('a swatch applies its colour', () => {
    const { onchange } = show({ swatches: ['#00ff00'] });

    document.querySelector<HTMLButtonElement>('button[aria-label="00FF00"]')!.click();

    expect(onchange).toHaveBeenCalledWith('#00ff00', undefined);
  });

  it('keeps the hue when a grey is picked on the square', () => {
    show({ value: '#808080' });

    expect(byId('colour-hue').getAttribute('aria-valuenow')).toBe('0');
  });
});
