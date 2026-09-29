import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import NodeInspector from './NodeInspector.svelte';
import { inspectorOf, FEED_FIELDS, PRODUCT_FIELDS } from '$lib/canvas/node-inspector';

const noop = () => {};

function html(type: string, data: Record<string, unknown>): string {
  const view = inspectorOf({ id: 'n', type, data })!;
  return render(NodeInspector, { props: { view, shown: 3, onfield: noop, onsync: noop, onclose: noop } }).body;
}

describe('NodeInspector disegna i campi dalla tabella, non a mano', () => {
  it('ogni campo del feed ha il suo controllo', () => {
    const body = html('social_account_feed', { platform: 'instagram', handle: 'nike', filters: { media: 'video' } });
    for (const field of FEED_FIELDS) {
      expect(body).toContain(`name="${field.path}"`);
      expect(body).toContain(field.label);
    }
  });

  it('ogni campo dei prodotti ha il suo controllo', () => {
    const body = html('products', { type: 'shopify', url: 'https://s.com' });
    for (const field of PRODUCT_FIELDS) {
      expect(body).toContain(`name="${field.path}"`);
    }
  });

  it('mostra lo stato e il costo della sincronizzazione', () => {
    const body = html('social_account_feed', { platform: 'instagram', handle: 'nike', sync_status: 'failed', sync_error: 'no_posts: nope' });
    expect(body).toContain('no_posts: nope');
    expect(body).toContain('Syncing costs no credits');
    expect(body).toContain('Sync now');
  });
});
