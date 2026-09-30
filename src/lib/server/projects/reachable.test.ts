import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

vi.mock('$app/environment', () => ({ dev: true, browser: false, building: false }));
vi.mock('$env/dynamic/private', () => ({ env: { UNCENSORED_DEV_MANUAL_VERIFICATION: 'true' } }));

const { findReachableProject } = await import('./lookup');

const ORG = 'org-1';
const USER = 'user-1';
const memberships = [{ org: { id: ORG, name: 'Acme', slug: 'acme' }, role: 'owner' as const }];

function seed(verified: boolean) {
  return {
    projects: [{ id: 'p-n', org_id: ORG, name: 'Night', slug: 'n', brand_id: null, archived_at: null, mode: 'uncensored' }],
    orgs: [{ id: ORG, stripe_subscription_id: 'sub_1' }],
    org_uncensored_optins: [{ org_id: ORG, enabled_by: USER, enabled_at: '2026-09-29T00:00:00Z', disabled_at: null }],
    user_age_verifications: verified ? [{ id: 'v', user_id: USER }] : []
  };
}

describe('the chat agent reaches an uncensored project only for a verified user', () => {
  it('an unverified member does not find it', async () => {
    const { db } = fakeDb(seed(false), { filter: true });
    expect(await findReachableProject(db, { projectId: 'p-n', memberships, userId: USER })).toBeNull();
  });

  it('a verified member does', async () => {
    const { db } = fakeDb(seed(true), { filter: true });
    expect((await findReachableProject(db, { projectId: 'p-n', memberships, userId: USER }))?.project.mode).toBe('uncensored');
  });
});
