import type { Db } from '$lib/server/db/client';
import { listMemberships, setActiveOrg, type OrgRole } from '$lib/server/repos/orgs';

export enum SwitchOutcome {
  Switched = 'switched',
  NotMember = 'not_member'
}

export type OrgSummary = { id: string; name: string; slug: string; role: OrgRole; active: boolean };

export async function orgsOf(db: Db, userId: string): Promise<OrgSummary[]> {
  const memberships = await listMemberships(db, userId);
  return memberships.map((m, index) => ({ ...m.org, role: m.role, active: index === 0 }));
}

export async function switchOrg(db: Db, input: { userId: string; orgId: string }): Promise<SwitchOutcome> {
  const memberships = await listMemberships(db, input.userId);
  if (!memberships.some((m) => m.org.id === input.orgId)) {
    return SwitchOutcome.NotMember;
  }

  await setActiveOrg(db, input);
  return SwitchOutcome.Switched;
}
