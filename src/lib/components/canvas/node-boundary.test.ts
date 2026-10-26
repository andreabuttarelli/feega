// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import BoundaryProbe from './fixtures/BoundaryProbe.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

describe('a node that fails to render', () => {
  let app: Record<string, unknown> | null = null;

  afterEach(() => {
    if (app) {
      unmount(app);
    }
    document.body.innerHTML = '';
  });

  it('shows its error inside the node and leaves the rest of the canvas standing', () => {
    app = mount(BoundaryProbe, { target: document.body, props: { fail: true } });
    flushSync();

    expect(document.body.textContent).toContain('other node');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('could not be cloned');
  });

  it('renders the node untouched when nothing fails', () => {
    app = mount(BoundaryProbe, { target: document.body, props: { fail: false } });
    flushSync();

    expect(document.body.textContent).toContain('node body');
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
});
