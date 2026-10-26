import { describe, expect, it, vi } from 'vitest';
import { CapReset, CapScope, type SpendCap } from './policy';
import { CAP_REACHED, capRefusal, type CapReader } from './gate';

const member: SpendCap = { scope: CapScope.OrgMember, projectId: null, capUsd: 10, reset: CapReset.None };
const total: SpendCap = { scope: CapScope.ProjectTotal, projectId: 'p1', capUsd: 50, reset: CapReset.Monthly };
const scope = { orgId: 'org', userId: 'u1', projectId: 'p1', now: new Date('2026-10-24T10:00:00Z') };

const reader = (caps: SpendCap[] | null, spent: number): CapReader => ({ caps: async () => caps, spent: vi.fn(async () => spent) });

describe('the spend cap gate before a run', () => {
  it('lets a run through when the org has set no caps', async () => {
    const r = reader([], 999);

    expect(await capRefusal(r, scope)).toBeNull();
    expect(r.spent).not.toHaveBeenCalled();
  });

  it('lets a run through when the caps table does not exist yet', async () => {
    expect(await capRefusal(reader(null, 999), scope)).toBeNull();
  });

  it('refuses once the member total reaches the cap, with a typed message', async () => {
    const refusal = await capRefusal(reader([member], 10), scope);

    expect(refusal).toContain(CAP_REACHED);
    expect(refusal).toContain('$10');
  });

  it('counts the member across the org and the project total across everyone', async () => {
    const r = reader([member, total], 0);

    await capRefusal(r, scope);

    expect(r.spent).toHaveBeenCalledWith({ orgId: 'org', userId: 'u1', since: null });
    expect(r.spent).toHaveBeenCalledWith({ orgId: 'org', projectId: 'p1', since: new Date('2026-10-01T00:00:00Z') });
  });

  it('a monthly cap is open again in the new month', async () => {
    const r = reader([total], 0);

    await capRefusal(r, { ...scope, now: new Date('2026-11-02T00:00:00Z') });

    expect(r.spent).toHaveBeenCalledWith(expect.objectContaining({ since: new Date('2026-11-01T00:00:00Z') }));
  });

  it('a spend that cannot be read does not block the run', async () => {
    const broken: CapReader = { caps: async () => [member], spent: async () => Promise.reject(new Error('down')) };

    expect(await capRefusal(broken, scope)).toBeNull();
  });
});
