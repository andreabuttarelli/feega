import { describe, expect, it } from 'vitest';
import { CapReset, CapScope, applicableCaps, capSince, firstReached, type SpendCap } from './policy';

const member: SpendCap = { scope: CapScope.OrgMember, projectId: null, capUsd: 10, reset: CapReset.None };
const inProject: SpendCap = { scope: CapScope.ProjectMember, projectId: 'p1', capUsd: 5, reset: CapReset.None };
const total: SpendCap = { scope: CapScope.ProjectTotal, projectId: 'p1', capUsd: 50, reset: CapReset.Monthly };
const elsewhere: SpendCap = { scope: CapScope.ProjectTotal, projectId: 'p2', capUsd: 1, reset: CapReset.None };

describe('which caps a run answers to', () => {
  it('the member cap of the org and the caps of the project it runs in', () => {
    expect(applicableCaps([member, inProject, total, elsewhere], 'p1')).toEqual([member, inProject, total]);
  });

  it('a run in another project leaves the first project caps alone', () => {
    expect(applicableCaps([member, inProject, total, elsewhere], 'p2')).toEqual([member, elsewhere]);
  });
});

describe('the period a cap counts', () => {
  const now = new Date('2026-10-24T15:00:00Z');

  it('a cap that never resets counts everything', () => {
    expect(capSince(member, now)).toBeNull();
  });

  it('a monthly cap counts from the first of the month, UTC', () => {
    expect(capSince(total, now)?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('the new month restores the room', () => {
    expect(capSince(total, new Date('2026-11-01T00:00:01Z'))?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('the first cap a run has already reached', () => {
  const spent = (amounts: Record<string, number>) => async (cap: SpendCap) => amounts[cap.scope] ?? 0;

  it('is none while every cap has room', async () => {
    expect(await firstReached([member, inProject, total], spent({ org_member: 9.99, project_member: 4.99, project_total: 49 }))).toBeNull();
  });

  it('is refused exactly at the cap, not after it', async () => {
    expect(await firstReached([member], spent({ org_member: 10 }))).toBe(member);
  });

  it('names the narrowest cap first so the message points at the right limit', async () => {
    expect(await firstReached([member, inProject, total], spent({ org_member: 11, project_member: 6, project_total: 60 }))).toBe(inProject);
  });

  it('asks nothing when there are no caps', async () => {
    expect(await firstReached([], async () => Promise.reject(new Error('should not be asked')))).toBeNull();
  });
});
