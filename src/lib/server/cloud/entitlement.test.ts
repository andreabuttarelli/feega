import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  seatCount: vi.fn(async (_customerId: string, _priceIds: string[]) => 0)
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/stripe', () => ({ cloudSeatCount: mocks.seatCount }));

import { fakeDb } from './testing/fake-db';
import { cloudEntitled, cloudSeats } from './entitlement';

const ORG = 'org-1';

const billedDb = () => fakeDb({ orgs: [{ id: ORG, stripe_customer_id: 'cus_1' }] });

beforeEach(() => {
  for (const key of Object.keys(mocks.env)) {
    delete mocks.env[key];
  }
  mocks.env.STRIPE_PRICE_CLOUD_MONTHLY = 'price_m';
  mocks.env.STRIPE_PRICE_CLOUD_ANNUAL = 'price_a';
  mocks.seatCount.mockReset();
  mocks.seatCount.mockResolvedValue(0);
});

describe('cloudSeats', () => {
  it('is the quantity subscribed on the Cloud prices', async () => {
    mocks.seatCount.mockResolvedValue(3);

    expect(await cloudSeats(billedDb(), ORG)).toBe(3);
    expect(mocks.seatCount).toHaveBeenCalledWith('cus_1', ['price_m', 'price_a']);
  });

  it('is zero for an org with no Stripe customer', async () => {
    expect(await cloudSeats(fakeDb({ orgs: [{ id: ORG, stripe_customer_id: null }] }), ORG)).toBe(0);
    expect(mocks.seatCount).not.toHaveBeenCalled();
  });

  it('is unlimited for an allowlisted org without asking Stripe', async () => {
    mocks.env.CLOUD_ORG_IDS = `other, ${ORG}`;

    expect(await cloudSeats(billedDb(), ORG)).toBe(Infinity);
    expect(mocks.seatCount).not.toHaveBeenCalled();
  });

  it('is zero when no Cloud price is configured', async () => {
    delete mocks.env.STRIPE_PRICE_CLOUD_MONTHLY;
    delete mocks.env.STRIPE_PRICE_CLOUD_ANNUAL;

    expect(await cloudSeats(billedDb(), ORG)).toBe(0);
    expect(mocks.seatCount).not.toHaveBeenCalled();
  });
});

describe('cloudEntitled', () => {
  it('is true with an active Cloud subscription', async () => {
    mocks.seatCount.mockResolvedValue(1);

    expect(await cloudEntitled(billedDb(), ORG)).toBe(true);
  });

  it('is false without a Cloud subscription or allowlist entry', async () => {
    expect(await cloudEntitled(billedDb(), ORG)).toBe(false);
  });
});
