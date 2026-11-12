import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const authorized = vi.fn();
const setSeatQuantity = vi.fn();
const world = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('$lib/server/cron-auth', () => ({ cronAuthorized: () => authorized() }));
vi.mock('$lib/server/stripe', () => ({ setSeatQuantity: (...args: unknown[]) => setSeatQuantity(...args) }));
vi.mock('$lib/server/db/client', () => ({ createServiceRoleDb: () => world.db }));

import { GET } from './+server';

const call = () => (GET as (e: unknown) => Promise<Response>)({ request: new Request('https://feega.test/api/v1/billing/seats/reconcile') });

beforeEach(() => {
  authorized.mockReset().mockReturnValue(true);
  setSeatQuantity.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  world.db = fakeDb(
    {
      orgs: [
        { id: 'paid', stripe_subscription_id: 'sub_paid' },
        { id: 'broken', stripe_subscription_id: 'sub_broken' },
        { id: 'free', stripe_subscription_id: null }
      ],
      orgs_members: [
        { org_id: 'paid', role: 'owner' },
        { org_id: 'paid', role: 'member' },
        { org_id: 'broken', role: 'owner' },
        { org_id: 'free', role: 'owner' }
      ]
    },
    { filter: true }
  ).db;
});

describe('GET /api/v1/billing/seats/reconcile', () => {
  it('sets every paying team to its editor count, and reports the ones Stripe refused', async () => {
    setSeatQuantity.mockImplementation(async (sub: string) => {
      if (sub === 'sub_broken') {
        throw new Error('down');
      }
    });

    const res = await call();

    expect(setSeatQuantity).toHaveBeenCalledWith('sub_paid', 2);
    expect(setSeatQuantity).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), 'free');
    expect(await res.json()).toEqual({ synced: 1, failed: ['broken'] });
  });

  it('answers 401 to anything but the cron', async () => {
    authorized.mockReturnValue(false);

    expect((await call()).status).toBe(401);
    expect(setSeatQuantity).not.toHaveBeenCalled();
  });
});
