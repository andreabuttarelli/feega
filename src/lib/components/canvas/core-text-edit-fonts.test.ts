// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import CoreTextEdit from './CoreTextEdit.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const LOOK = { fontPx: 54, family: "'Inter Tight', sans-serif", weight: 600, italic: false, trackingEm: 0, leading: 1.2, color: '#000', textTransform: 'none', align: 'left', wrap: 'pre', trim: 'none', decoration: 'none' };
const LAYOUT = { matrix: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number], transform: 'none', width: 300, height: 60, fontPx: 54, wraps: false, vertical: 0 };

let app: Record<string, unknown> | null = null;
let measured = 0;

afterEach(() => {
  if (app) {
    unmount(app);
  }
  app = null;
  document.body.innerHTML = '';
});

describe('the text box while typing', () => {
  it('measures again when the web font arrives, instead of keeping the fallback width', async () => {
    const fonts = Object.assign(new EventTarget(), { ready: new Promise(() => {}) });
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => measured });

    app = mount(CoreTextEdit, { target: document.body, props: { layout: LAYOUT, look: LOOK, text: 'Highlands', body: (text: string) => text, oncommit: () => {} } });
    flushSync();
    await new Promise((r) => setTimeout(r, 0));
    flushSync();
    const field = document.querySelector<HTMLElement>('[data-testid="core-text-edit"]')!;
    field.textContent = 'Highlands';

    measured = 80;
    fonts.dispatchEvent(new Event('loadingdone'));

    expect(field.style.width).toBe('82px');
  });
});
