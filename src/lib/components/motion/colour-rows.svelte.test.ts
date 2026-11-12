// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRAND_COLORS } from '@feega/motion-core/motion/components';
import { colourLabel } from '$lib/motion/colour-field';
import type { ColourUse } from '$lib/motion/selection-colours';
import ColourRows from './ColourRows.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const TOKEN = BRAND_COLORS[0];

let app: Record<string, unknown> | null = null;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (app) {
    unmount(app);
    app = null;
  }
  document.body.innerHTML = '';
});

function show(start: ColourUse[]) {
  const props = $state({
    colours: start,
    palette: () => [],
    onswap: (from: string, to: string) => {
      const moved = props.colours.find((c) => c.colour === from)!;
      const into = props.colours.find((c) => c.colour === to);
      const rest = props.colours.filter((c) => c.colour !== from && c.colour !== to);
      props.colours = [{ colour: to, count: moved.count + (into?.count ?? 0) }, ...rest];
    }
  });
  app = mount(ColourRows, { target: document.body, props });
  flushSync();
  return props;
}

function pickFrom(colour: string, label: string) {
  document.querySelector<HTMLButtonElement>(`[data-colour="${colour}"] button.row`)!.click();
  flushSync();
  const swatch = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="colour-popover"] button.swatch')].find((b) => b.getAttribute('aria-label')?.startsWith(label))!;
  swatch.focus();
  swatch.click();
  flushSync();
}

const focusedSwatch = () => document.activeElement?.closest('[data-testid="colour-popover"]') && document.activeElement.classList.contains('swatch');

describe('selection colour rows', () => {
  it('keep focus on the brand swatch that recoloured the row, so Tab and Escape still work', () => {
    show([{ colour: '#ff0000', count: 2 }, { colour: '#00ff00', count: 1 }]);

    pickFrom('#ff0000', colourLabel(TOKEN));

    expect(focusedSwatch()).toBe(true);
    expect(document.querySelectorAll('[data-testid="colour-popover"]')).toHaveLength(1);
  });

  it('keep the open picker when the new colour merges into a row already listed', () => {
    const props = show([{ colour: '#ff0000', count: 2 }, { colour: TOKEN, count: 1 }]);

    pickFrom('#ff0000', colourLabel(TOKEN));

    expect(props.colours).toEqual([{ colour: TOKEN, count: 3 }]);
    expect(focusedSwatch()).toBe(true);
  });

  it('give a colour that comes back after a swap a row of its own', () => {
    const props = show([{ colour: '#ff0000', count: 2 }]);
    pickFrom('#ff0000', colourLabel(TOKEN));

    props.colours = [{ colour: TOKEN, count: 1 }, { colour: '#ff0000', count: 1 }];
    flushSync();

    expect(document.querySelectorAll('button.row')).toHaveLength(2);
  });
});
