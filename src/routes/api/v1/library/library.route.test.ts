import { beforeEach, describe, expect, it, vi } from 'vitest';
import { json } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  call: null as unknown,
  store: null as unknown,
  seatCount: vi.fn(async (_customerId: string, _priceIds: string[]) => 0)
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/stripe', () => ({ cloudSeatCount: mocks.seatCount }));
vi.mock('$lib/server/cli-auth', () => ({
  openOrg: async () => (mocks.call ? { call: mocks.call } : { error: json({ error: 'Missing or invalid Authorization header' }, { status: 401 }) })
}));
vi.mock('$lib/server/library/storage-store', () => ({ storageStore: () => mocks.store }));

import { fakeDb } from '$lib/server/cloud/testing/fake-db';
import { fakeStore, type FakeStore } from '$lib/server/library/testing/fake-store';
import type { IndexEntry } from '$lib/server/library/library';
import { GET as CATALOGUE } from './+server';
import { GET as FILES } from './[id]/[framework]/+server';

const ORG = 'org-1';
const CARD = [{ path: 'Card.svelte', content: '<div>card</div>' }];
const HERO = [{ path: 'Hero.svelte', content: '<section>pro hero</section>' }];

const INDEX: IndexEntry[] = [
  { id: 'card', name: 'Card', category: 'component', tags: ['content'], frameworks: ['svelte', 'react'], tier: 'free', previewUrl: 'https://docs.feega.app/library/card' },
  { id: 'hero', name: 'Hero', category: 'section', tags: ['landing'], frameworks: ['svelte'], tier: 'pro', previewUrl: 'https://docs.feega.app/library/hero' }
];

function store(): FakeStore {
  return mocks.store as FakeStore;
}

function request(path: string) {
  return new Request(`https://oh.feega.app/api/v1/library${path}`, { headers: { authorization: 'Bearer t' } });
}

async function catalogue() {
  return CATALOGUE({ request: request('') } as never);
}

async function files(id: string, framework: string) {
  return FILES({ request: request(`/${id}/${framework}`), params: { id, framework } } as never);
}

beforeEach(() => {
  for (const key of Object.keys(mocks.env)) {
    delete mocks.env[key];
  }
  mocks.env.STRIPE_PRICE_CLOUD_MONTHLY = 'price_m';
  mocks.env.STRIPE_PRICE_CLOUD_ANNUAL = 'price_a';
  mocks.seatCount.mockReset();
  mocks.seatCount.mockResolvedValue(0);
  mocks.store = fakeStore(INDEX, { 'card/svelte': CARD, 'hero/svelte': HERO });
  mocks.call = { supabase: fakeDb({ orgs: [{ id: ORG, stripe_customer_id: 'cus_1' }] }), user: { id: 'ada' }, orgId: ORG };
});

describe('GET /api/v1/library', () => {
  it('rejects a call without a token', async () => {
    mocks.call = null;

    expect((await catalogue()).status).toBe(401);
  });

  it('lists every item and locks the Pro ones for an org without Cloud', async () => {
    const body = await (await catalogue()).json();

    expect(body.items.map((item: { id: string; locked: boolean }) => [item.id, item.locked])).toEqual([
      ['card', false],
      ['hero', true]
    ]);
    expect(body.items[1]).toEqual({
      id: 'hero',
      name: 'Hero',
      category: 'section',
      tags: ['landing'],
      frameworks: ['svelte'],
      tier: 'pro',
      previewUrl: 'https://docs.feega.app/library/hero',
      locked: true
    });
  });

  it('unlocks the Pro items for an org subscribed to Cloud', async () => {
    mocks.seatCount.mockResolvedValue(1);

    const body = await (await catalogue()).json();

    expect(body.items.map((item: { locked: boolean }) => item.locked)).toEqual([false, false]);
    expect(mocks.seatCount).toHaveBeenCalledWith('cus_1', ['price_m', 'price_a']);
  });

  it('never puts file content in the catalogue', async () => {
    const text = await (await catalogue()).text();

    expect(text).not.toContain('pro hero');
    expect(store().reads).toEqual(['index']);
  });
});

describe('GET /api/v1/library/:id/:framework', () => {
  it('rejects a call without a token', async () => {
    mocks.call = null;

    expect((await files('card', 'svelte')).status).toBe(401);
  });

  it('serves a free item to an org without Cloud', async () => {
    const res = await files('card', 'svelte');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'card', framework: 'svelte', files: CARD });
  });

  it('answers 402 plan_required for a Pro item and never reads its content', async () => {
    const res = await files('hero', 'svelte');

    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: 'plan_required' });
    expect(store().reads).not.toContain('hero/svelte');
  });

  it('serves a Pro item to an org subscribed to Cloud', async () => {
    mocks.seatCount.mockResolvedValue(2);

    const res = await files('hero', 'svelte');

    expect(res.status).toBe(200);
    expect((await res.json()).files).toEqual(HERO);
  });

  it('serves a Pro item to an org on the Cloud allowlist', async () => {
    mocks.env.CLOUD_ORG_IDS = ORG;

    expect((await files('hero', 'svelte')).status).toBe(200);
  });

  it('answers 404 for an unknown item', async () => {
    const res = await files('nope', 'svelte');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'item_not_found' });
  });

  it('answers 404 for a framework the item does not ship', async () => {
    const res = await files('card', 'vue');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'framework_not_found' });
  });

  it('answers 400 for an id that could escape the bucket path', async () => {
    const res = await files('../secrets', 'svelte');

    expect(res.status).toBe(400);
    expect(store().reads).toEqual([]);
  });
});
