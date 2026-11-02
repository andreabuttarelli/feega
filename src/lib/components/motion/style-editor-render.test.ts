// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { StyleKind, type Style } from '@feega/motion-core/motion/styles-model';
import { BuiltinFont } from '@feega/motion-core/motion/fonts/model';
import StyleEditor from './StyleEditor.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

let app: Record<string, unknown> | null = null;

function edit(name: string, style: Style) {
  const calls = { onrename: vi.fn(), onremove: vi.fn(), onedit: vi.fn() };
  app = mount(StyleEditor, { target: document.body, props: { name, style, swatch: null, tokens: FEEGA_TOKENS, unit: 1080, ...calls } });
  flushSync();
  return calls;
}

afterEach(() => {
  if (app) {
    unmount(app);
  }
  app = null;
  document.body.innerHTML = '';
});

describe('the editor of a style in the Styles panel', () => {
  it('deletes the style with one click, no menu between', () => {
    const { onremove } = edit('Ink', { kind: StyleKind.Colour, color: '#111111' });

    document.querySelector<HTMLButtonElement>('[data-testid="style-library-remove-Ink"]')!.click();

    expect(onremove).toHaveBeenCalledOnce();
  });

  it('a text style without a font shows the font its text is drawn with', () => {
    edit('Body', { kind: StyleKind.Text, size: 0.05, weight: 400 });

    expect(document.querySelector(`[data-testid="style-library-font-Body"] button[aria-label="Font ${BuiltinFont.Sans}"]`)).not.toBeNull();
  });
});
