// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NumberField from './NumberField.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const TICKS = 40;

let app: Record<string, unknown> | null = null;

beforeEach(() => {
  Element.prototype.setPointerCapture = () => {};
});

afterEach(() => {
  if (app) {
    unmount(app);
    app = null;
  }
  document.body.innerHTML = '';
});

function show() {
  const onchange = vi.fn();
  const gesture = { begin: vi.fn(), release: vi.fn(), cancel: vi.fn() };
  app = mount(NumberField, { target: document.body, props: { label: 'α', name: 'Opacity', value: 50, range: { min: 0, max: 100, step: 1 }, gesture, onchange } });
  flushSync();
  return { onchange, gesture, input: document.querySelector<HTMLInputElement>('input')!, label: document.querySelector<HTMLElement>('.label')! };
}

function pointer(el: Element, type: string, fields: Record<string, number>) {
  const e = new Event(type, { bubbles: true }) as Event & Record<string, number>;
  Object.assign(e, { pointerId: 1, button: 0, pointerType: 'mouse', clientX: 0, movementX: 0, ...fields });
  el.dispatchEvent(e);
  flushSync();
}

describe('number field scrub', () => {
  it('drags the value as one live gesture: begun once, released once', () => {
    const { onchange, gesture, input } = show();

    pointer(input, 'pointerdown', {});
    for (let i = 0; i < TICKS; i++) {
      pointer(input, 'pointermove', { movementX: 2 });
    }
    pointer(input, 'pointerup', {});

    expect(onchange.mock.calls.length).toBeGreaterThan(1);
    expect(gesture.begin).toHaveBeenCalledTimes(1);
    expect(gesture.release).toHaveBeenCalledTimes(1);
  });

  it('shows the scrubbed value while the document still holds the old one', () => {
    const { input } = show();

    pointer(input, 'pointerdown', {});
    for (let i = 0; i < TICKS; i++) {
      pointer(input, 'pointermove', { movementX: 2 });
    }

    expect(input.value).not.toBe('50');
  });

  it('drags the label as one live gesture too', () => {
    const { onchange, gesture, label } = show();

    pointer(label, 'pointerdown', { clientX: 0 });
    for (let i = 1; i <= TICKS; i++) {
      pointer(label, 'pointermove', { clientX: i * 2 });
    }
    pointer(label, 'pointerup', { clientX: TICKS * 2 });

    expect(onchange.mock.calls.length).toBeGreaterThan(1);
    expect(gesture.begin).toHaveBeenCalledTimes(1);
    expect(gesture.release).toHaveBeenCalledTimes(1);
  });

  it('a click that never scrubs opens no gesture', () => {
    const { gesture, input } = show();

    pointer(input, 'pointerdown', {});
    pointer(input, 'pointerup', {});

    expect(gesture.begin).not.toHaveBeenCalled();
    expect(gesture.release).not.toHaveBeenCalled();
  });
});
