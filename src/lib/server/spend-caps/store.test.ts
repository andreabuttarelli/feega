import { describe, expect, it } from 'vitest';
import { fakeDb, filtersOf } from '$lib/server/db/fake-db';
import { CapReset, CapScope } from './policy';
import { readCaps, removeCap, saveCap, spentUsd } from './store';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';

describe('the caps of an org', () => {
  it('are read for that org and typed', async () => {
    const { db, calls } = fakeDb({ org_spend_caps: [{ scope: 'project_total', project_id: PROJECT, cap_usd: '12.50', reset: 'monthly' }] });

    expect(await readCaps(db, ORG)).toEqual([{ scope: CapScope.ProjectTotal, projectId: PROJECT, capUsd: 12.5, reset: CapReset.Monthly }]);
    expect(filtersOf(calls, 'select')).toEqual({ org_id: ORG });
  });

  it('saving replaces the cap of the same scope and project', async () => {
    const { db, calls } = fakeDb({ org_spend_caps: [] });

    const saved = await saveCap(db, { orgId: ORG, cap: { scope: CapScope.ProjectMember, projectId: PROJECT, capUsd: 5, reset: CapReset.None } });

    expect(saved).toBe(true);
    expect(calls.map((c) => c.op)).toEqual(['delete', 'insert']);
    expect(filtersOf(calls, 'delete')).toEqual({ org_id: ORG, scope: 'project_member', project_id: PROJECT });
    expect(calls[1].payload).toMatchObject({ org_id: ORG, scope: 'project_member', project_id: PROJECT, cap_usd: 5, reset: 'none' });
  });

  it('removing an org-wide member cap matches the null project', async () => {
    const { db, calls } = fakeDb({ org_spend_caps: [] });

    await removeCap(db, { orgId: ORG, scope: CapScope.OrgMember, projectId: null });

    expect(filtersOf(calls, 'delete')).toEqual({ org_id: ORG, scope: 'org_member', project_id: null });
  });
});

describe('what a person or project has spent', () => {
  it('sums cost for the org, narrowed by person, project and period', async () => {
    const { db, calls } = fakeDb({ ai_calls: [{ cost_usd: 0.5 }, { cost_usd: null }, { cost_usd: 1.25 }] });

    const total = await spentUsd(db, { orgId: ORG, userId: 'u1', projectId: PROJECT, since: new Date('2026-10-01T00:00:00Z') });

    expect(total).toBe(1.75);
    expect(filtersOf(calls, 'select')).toMatchObject({ org_id: ORG, actor_id: 'u1', project_id: PROJECT, 'created_at>=': '2026-10-01T00:00:00.000Z' });
  });
});
