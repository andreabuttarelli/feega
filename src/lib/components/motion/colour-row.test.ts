// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRAND_COLORS } from '@feega/motion-core/motion/components';
import { colourLabel } from '$lib/motion/colour-field';
import ColourRow from './ColourRow.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const TOKEN = BRAND_COLORS[0];

let app: Record<string, unknown> | null = null;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.setPointerCapture = () => {};
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (app) {
    unmount(app);
    app = null;
  }
  document.body.innerHTML = '';
});

function show(colour: string, props: Record<string, unknown> = {}) {
  const onchange = vi.fn();
  app = mount(ColourRow, { target: document.body, props: { colour, count: 3, onchange, ...props } });
  flushSync();
  return { onchange };
}

const query = <T extends Element>(selector: string) => document.querySelector<T>(selector);

describe('colour row', () => {
  it('shows a hex colour as a swatch and a label in one button', () => {
    show('#ff0000');
    const button = query<HTMLButtonElement>('button.row')!;
    expect(button.textContent).toContain('#FF0000');
    expect(button.querySelector('.swatch')).not.toBeNull();
    expect(query('.token-glyph')).toBeNull();
  });

  it('shows a token by name with a glyph and its resolved colour', () => {
    show(TOKEN);
    const button = query<HTMLButtonElement>('button.row')!;
    expect(button.textContent).toContain(colourLabel(TOKEN));
    expect(button.querySelector('.token-glyph')).not.toBeNull();
    expect(button.querySelector<HTMLElement>('.swatch')!.getAttribute('style')).toMatch(/#[0-9a-f]{6}/i);
  });

  it('shows the count and no select', () => {
    show(TOKEN);
    expect(query('.count')!.textContent).toBe('3');
    expect(query('select')).toBeNull();
  });

  it('opens the colour picker from the row button', () => {
    show('#00ff00');
    expect(query('[data-testid="colour-popover"]')).toBeNull();
    query<HTMLButtonElement>('button.row')!.click();
    flushSync();
    expect(query('[data-testid="colour-popover"]')).not.toBeNull();
  });

  it('offers to select the layers only when it can', () => {
    show('#00ff00');
    expect(query('[data-testid="select-layers"]')).toBeNull();
    document.body.innerHTML = '';
    const onselect = vi.fn();
    show('#00ff00', { onselect });
    query<HTMLButtonElement>('[data-testid="select-layers"]')!.click();
    expect(onselect).toHaveBeenCalledWith('#00ff00');
  });
});
