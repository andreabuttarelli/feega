// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SidePopover from './SidePopover.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { createRawSnippet, flushSync, mount, unmount } = (await import(join(dir, '../../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

let app: Record<string, unknown> | null = null;

afterEach(() => {
  if (app) {
    unmount(app);
  }
  app = null;
  document.body.innerHTML = '';
});

describe('side popover', () => {
  it('lives on the body, above the bottom toolbar, not inside the panel that opened it', () => {
    const panel = document.createElement('div');
    panel.className = 'chat-pane';
    document.body.append(panel);
    const anchor = document.createElement('button');
    panel.append(anchor);

    app = mount(SidePopover, { target: panel, props: { anchor, title: 'Solid', onclose: vi.fn(), children: createRawSnippet(() => ({ render: () => '<p>fill</p>' })) } });
    flushSync();

    expect(document.querySelector('[data-testid="side-popover"]')!.parentElement).toBe(document.body);
  });
});
