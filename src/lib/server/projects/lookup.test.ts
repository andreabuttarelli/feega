import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { findProjectForUser } from './lookup';
import type { Membership } from '$lib/server/repos/orgs';

const ORG = 'org-1';
const memberships = [{ org: { id: ORG, name: 'Org', slug: 'org' }, role: 'owner' }] as unknown as Membership[];

describe('aprire un progetto per URL', () => {
  it('apre un progetto vivo della propria org', async () => {
    const { db } = fakeDb({ projects: [{ id: 'p1', org_id: ORG, name: 'P', slug: 'p', brand_id: null, archived_at: null }] }, { filter: true });

    const found = await findProjectForUser(db, { projectId: 'p1', memberships });

    expect(found?.project.id).toBe('p1');
  });

  it('un progetto archiviato non si apre più, nemmeno conoscendo l URL', async () => {
    const { db } = fakeDb(
      { projects: [{ id: 'p1', org_id: ORG, name: 'P', slug: 'p', brand_id: null, archived_at: '2026-09-27T00:00:00Z' }] },
      { filter: true }
    );

    await expect(findProjectForUser(db, { projectId: 'p1', memberships })).resolves.toBeNull();
  });
});
