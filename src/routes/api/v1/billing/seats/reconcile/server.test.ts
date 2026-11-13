import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb, type Row } from '$lib/server/local/memory-db';

const authorized = vi.fn();
const setSeatQuantity = vi.fn();
const seatSubscription = vi.fn();
const world = vi.hoisted(() => ({ db: null as unknown, tables: null as unknown as Map<string, Row[]> }));

vi.mock('$lib/server/cron-auth', () => ({ cronAuthorized: () => authorized() }));
vi.mock('$lib/server/stripe', () => ({
  SeatProration: { None: 'none', Invoice: 'always_invoice' },
  setSeatQuantity: (...args: unknown[]) => setSeatQuantity(...args),
  seatSubscription: (...args: unknown[]) => seatSubscription(...args)
}));
vi.mock('$lib/server/db/client', () => ({
  createServiceRoleDb: () =>
    new Proxy(world.db as object, {
      get: (target, key) => (key === 'rpc' ? async (name: string) => ({ data: name === 'claim_seat_sync' ? true : null, error: null }) : Reflect.get(target, key))
    })
}));
const sendEmail = vi.fn();
vi.mock('$lib/server/email', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

import { GET } from './+server';
import { RECONCILE_BATCH } from '$lib/server/team/seat-billing';

const call = () => (GET as (e: unknown) => Promise<Response>)({ request: new Request('https://feega.test/api/v1/billing/seats/reconcile') });

function seed(paidOrgs: number) {
  const orgs: Row[] = [{ id: 'free', stripe_subscription_id: null, seats_checked_at: null }];
  const members: Row[] = [{ org_id: 'free', role: 'owner' }];
  for (let i = 0; i < paidOrgs; i++) {
    orgs.push({ id: `org-${i}`, stripe_subscription_id: `sub_${i}`, seats_checked_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() });
    members.push({ org_id: `org-${i}`, user_id: `owner-${i}`, role: 'owner' }, { org_id: `org-${i}`, user_id: `member-${i}`, role: 'member' });
  }
  const profiles: Row[] = members.filter((m) => m.role === 'owner').map((m) => ({ id: m.user_id, email: `${m.user_id}@acme.test` }));
  world.tables = new Map<string, Row[]>([['orgs', orgs], ['orgs_members', members], ['profiles', profiles]]);
  world.db = createMemoryDb({ tables: world.tables, blobs: new Map(), user: { id: 'cron', email: 'c@x', created_at: '2026-01-01' }, storageUrl: () => '', onChange: () => {} });
}

beforeEach(() => {
  authorized.mockReset().mockReturnValue(true);
  setSeatQuantity.mockReset().mockResolvedValue(undefined);
  seatSubscription.mockReset().mockImplementation(async (sub: string) => ({ itemId: `si_${sub}`, quantity: 1, perEditor: true, status: 'active', endsAt: null }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sendEmail.mockReset().mockResolvedValue(undefined);
});

describe('GET /api/v1/billing/seats/reconcile', () => {
  it('sets each paying team to its editor count, oldest checked first, a bounded batch per run', async () => {
    seed(RECONCILE_BATCH + 5);

    const res = await call();

    expect(res.status).toBe(200);
    expect(seatSubscription).toHaveBeenCalledTimes(RECONCILE_BATCH);
    expect(seatSubscription).toHaveBeenNthCalledWith(1, 'sub_0');
    expect(setSeatQuantity).toHaveBeenCalledWith('sub_0', 'si_sub_0', 2, 'always_invoice');

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner-0@acme.test' }));

    seatSubscription.mockClear();
    await call();
    expect(seatSubscription).toHaveBeenNthCalledWith(1, `sub_${RECONCILE_BATCH}`);
  });

  it('a team Stripe refuses makes the run fail loudly, naming it', async () => {
    seed(2);
    seatSubscription.mockImplementation(async (sub: string) => {
      if (sub === 'sub_1') {
        throw new Error('down');
      }
      return { itemId: 'si', quantity: 2, perEditor: true, status: 'active', endsAt: null };
    });

    const res = await call();

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ failed: ['org-1'] });
  });

  it('answers 401 to anything but the cron', async () => {
    seed(1);
    authorized.mockReturnValue(false);

    expect((await call()).status).toBe(401);
    expect(seatSubscription).not.toHaveBeenCalled();
  });
});
