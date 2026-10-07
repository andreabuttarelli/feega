// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompositionNode } from '$lib/canvas/composition-node';
import BentoPanel from './BentoPanel.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const node: CompositionNode = {
  id: 'n1',
  layout: 'bento',
  layoutParams: { columns: 2, rows: 2, gap: 24, cornerRadius: 0 },
  camera: { preset: 'static', params: {} },
  background: { color: '#000000' },
  duration: 6,
  aspect: '9:16',
  refId: null,
  cells: {}
};

describe('the bento panel on a composition node', () => {
  let app: Record<string, unknown> | null = null;

  afterEach(() => {
    if (app) {
      unmount(app);
    }
    document.body.innerHTML = '';
  });

  it('starts closed, so the preview stays visible, and opens on demand', () => {
    app = mount(BentoPanel, { target: document.body, props: { node, cards: [{ sourceId: 'img', assetId: 'a1', kind: 'image' }], onpatch: () => {} } });
    flushSync();

    const panel = document.querySelector<HTMLDetailsElement>('details[data-testid="bento-panel"]');
    expect(panel?.open).toBe(false);
    expect(panel?.querySelector('summary')?.textContent).toContain('Grid');
  });
});
