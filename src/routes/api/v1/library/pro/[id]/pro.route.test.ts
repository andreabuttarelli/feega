import { beforeEach, describe, expect, it, vi } from 'vitest';
import { json } from '@sveltejs/kit';
import type { ProLatest, ProStore } from '$lib/server/library/pro-library';

const mocks = vi.hoisted(() => ({
  call: null as unknown,
  store: null as unknown,
  cloudActive: vi.fn(async (_subscriptionId: string) => false)
}));

vi.mock('$lib/server/stripe', () => ({ cloudSubscriptionActive: mocks.cloudActive }));
vi.mock('$lib/server/cli-auth', () => ({
  openOrg: async () => (mocks.call ? { call: mocks.call } : { error: json({ error: 'Missing or invalid Authorization header' }, { status: 401 }) })
}));
vi.mock('$lib/server/library/storage-store', () => ({ storageStore: () => mocks.store }));

import { GET } from './+server';

const ORG = 'org-1';
const LATEST: ProLatest = { id: 'hover-reveal', version: 'abc123', frameworks: { svelte: ['HoverReveal.svelte'], html: ['index.html', 'style.css'] } };

function bucket(contents: Record<string, string>): ProStore & { reads: string[] } {
  const reads: string[] = [];

  return {
    reads,
    async latest(id) {
      reads.push(`latest:${id}`);

      return id === LATEST.id ? LATEST : null;
    },
    async file(id, version, framework, path) {
      reads.push(`${id}/${version}/${framework}/${path}`);

      return contents[`${framework}/${path}`] ?? null;
    }
  };
}

function callWith(subscriptionId: string | null) {
  const org = { stripe_subscription_id: subscriptionId };

  return { supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: org }) }) }) }) }, user: { id: 'ada' }, orgId: ORG };
}

async function get(id: string, query = '?framework=svelte') {
  const url = `https://oh.feega.app/api/v1/library/pro/${id}${query}`;

  return GET({ request: new Request(url, { headers: { authorization: 'Bearer t' } }), params: { id }, url: new URL(url) } as never);
}

beforeEach(() => {
  mocks.cloudActive.mockReset();
  mocks.cloudActive.mockResolvedValue(false);
  mocks.store = bucket({ 'svelte/HoverReveal.svelte': '<section class="fl-hover-reveal" />', 'html/index.html': '<section />', 'html/style.css': 'section{}' });
  mocks.call = callWith('sub_1');
});

describe('GET /api/v1/library/pro/:id', () => {
  it('answers 401 without a token and reads nothing', async () => {
    mocks.call = null;

    const res = await get('hover-reveal');

    expect(res.status).toBe(401);
    expect((mocks.store as ReturnType<typeof bucket>).reads).toEqual([]);
  });

  it('answers 402 Included in Feega Cloud for an org without a Cloud plan and never reads the bucket', async () => {
    const res = await get('hover-reveal');

    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: 'plan_required', message: 'Included in Feega Cloud' });
    expect((mocks.store as ReturnType<typeof bucket>).reads).toEqual([]);
  });

  it('answers 402 for an org that never subscribed, without asking Stripe', async () => {
    mocks.call = callWith(null);

    expect((await get('hover-reveal')).status).toBe(402);
    expect(mocks.cloudActive).not.toHaveBeenCalled();
  });

  it('serves the files of the requested framework to an org on Cloud', async () => {
    mocks.cloudActive.mockResolvedValue(true);

    const res = await get('hover-reveal');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'hover-reveal',
      version: 'abc123',
      framework: 'svelte',
      files: [{ path: 'HoverReveal.svelte', content: '<section class="fl-hover-reveal" />' }]
    });
    expect(mocks.cloudActive).toHaveBeenCalledWith('sub_1');
  });

  it('serves every file of a multi-file framework', async () => {
    mocks.cloudActive.mockResolvedValue(true);

    const body = await (await get('hover-reveal', '?framework=html')).json();

    expect(body.files.map((file: { path: string }) => file.path)).toEqual(['index.html', 'style.css']);
  });

  it('answers 400 when the framework is missing or unknown', async () => {
    mocks.cloudActive.mockResolvedValue(true);

    expect((await get('hover-reveal', '')).status).toBe(400);
    expect((await get('hover-reveal', '?framework=angular')).status).toBe(400);
  });

  it('answers 400 for an id that could leave the bucket folder', async () => {
    mocks.cloudActive.mockResolvedValue(true);

    const res = await get('..%2Fsecrets');

    expect(res.status).toBe(400);
    expect((mocks.store as ReturnType<typeof bucket>).reads).toEqual([]);
  });

  it('answers 404 for an item that is not in the bucket', async () => {
    mocks.cloudActive.mockResolvedValue(true);

    const res = await get('unknown-item');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'item_not_found' });
  });

  it('answers 404 for a framework the item does not ship', async () => {
    mocks.cloudActive.mockResolvedValue(true);

    const res = await get('hover-reveal', '?framework=vue');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'framework_not_found' });
  });
});
