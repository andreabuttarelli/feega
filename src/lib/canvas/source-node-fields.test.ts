import { describe, expect, it } from 'vitest';
import { newNodeRow, socialFeedData, socialFeedOf } from '$lib/canvas-node-data';
import { NODE_DATA_SCHEMAS, describeNodeType } from './node-data';
import { DEFAULT_FEED_FILTERS } from './source-filters';

describe('social_account_feed: filtri', () => {
  it('una riga di prima si legge coi default', () => {
    const node = socialFeedOf({ id: 'f', type: 'social_account_feed', data: { platform: 'instagram', handle: 'nike' } });
    expect(node?.filters).toEqual(DEFAULT_FEED_FILTERS);
  });

  it('i filtri fanno andata e ritorno e passano lo schema', () => {
    const filters = { ...DEFAULT_FEED_FILTERS, media: 'video' as const, min_likes: 1000, from: '2026-01-01' };
    const node = socialFeedOf({ id: 'f', type: 'social_account_feed', data: { platform: 'tiktok', handle: 'nike', filters } })!;
    const data = socialFeedData(node);
    expect(data.filters).toEqual(filters);
    expect(NODE_DATA_SCHEMAS.social_account_feed.safeParse(data).success).toBe(true);
  });

  it('lo schema rifiuta una data non ISO', () => {
    expect(
      NODE_DATA_SCHEMAS.social_account_feed.safeParse({ platform: 'x', handle: 'a', filters: { from: '01/02/2026' } }).success
    ).toBe(false);
  });

  it('un nodo nuovo nasce valido e describe_node_types mostra i filtri', () => {
    expect(NODE_DATA_SCHEMAS.social_account_feed.safeParse(newNodeRow('social_account_feed')).success).toBe(true);
    expect(JSON.stringify(describeNodeType('social_account_feed'))).toContain('min_views');
  });
});
