import { describe, expect, it, vi } from 'vitest';
import { buildAdsSocialState } from './ads-social-load';
import type { Brand } from '$lib/server/repos/brands';
import type { AdAccount } from '$lib/server/repos/ads';
import type { Db } from '$lib/server/db/client';

const db = {} as Db;

const brand: Brand = {
  id: 'brand-1',
  name: 'Acme',
  slug: 'acme',
  website: null,
  shortDescription: null,
  logoUrl: null
};

const adAccount: AdAccount = {
  id: 'acct-1',
  brandId: 'brand-1',
  platform: 'metaads',
  name: 'Acme Meta Ads',
  currency: 'USD',
  status: 'active'
};

describe('buildAdsSocialState', () => {
  it('is no_brand when the project has no brand_id', async () => {
    const findBrand = vi.fn();
    const listAdAccounts = vi.fn();

    const state = await buildAdsSocialState(
      { findBrand, listAdAccounts },
      { orgId: 'org-1', brandId: null, db }
    );

    expect(state).toEqual({ kind: 'no_brand' });
    expect(findBrand).not.toHaveBeenCalled();
  });

  it('is no_brand when brandId points at a brand outside the org', async () => {
    const findBrand = vi.fn().mockResolvedValue(null);
    const listAdAccounts = vi.fn();

    const state = await buildAdsSocialState(
      { findBrand, listAdAccounts },
      { orgId: 'org-1', brandId: 'brand-1', db }
    );

    expect(state).toEqual({ kind: 'no_brand' });
    expect(listAdAccounts).not.toHaveBeenCalled();
  });

  it('is no_ad_account when the brand has none connected', async () => {
    const findBrand = vi.fn().mockResolvedValue(brand);
    const listAdAccounts = vi.fn().mockResolvedValue([]);

    const state = await buildAdsSocialState(
      { findBrand, listAdAccounts },
      { orgId: 'org-1', brandId: 'brand-1', db }
    );

    expect(state).toEqual({ kind: 'no_ad_account', brand });
  });

  it('is ready when the brand has at least one ad account', async () => {
    const findBrand = vi.fn().mockResolvedValue(brand);
    const listAdAccounts = vi.fn().mockResolvedValue([adAccount]);

    const state = await buildAdsSocialState(
      { findBrand, listAdAccounts },
      { orgId: 'org-1', brandId: 'brand-1', db }
    );

    expect(state).toEqual({ kind: 'ready', brand, adAccounts: [adAccount] });
  });
});
