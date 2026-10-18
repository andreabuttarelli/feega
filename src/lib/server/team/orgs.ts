import type { Db } from '$lib/server/db/client';
import { listMemberships, setActiveOrg, type OrgRole } from '$lib/server/repos/orgs';
import { createFirstOrg } from '$lib/server/tenancy/bootstrap';
import { FreeOrgLimitReachedError } from '$lib/server/tenancy/free-org-limit';

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

export enum CreateOutcome {
  Created = 'created',
  InvalidName = 'invalid_name',
  FreeLimit = 'free_org_limit_reached'
}

export type CreateResult = { outcome: CreateOutcome.Created; orgId: string } | { outcome: CreateOutcome.InvalidName | CreateOutcome.FreeLimit };

export type CreateDeps = { createFirstOrg: typeof createFirstOrg };

export const CREATE_DEPS: CreateDeps = { createFirstOrg };

const MAX_ORG_NAME = 80;

export async function createOrg(db: Db, deps: CreateDeps, input: { userId: string; name: string }): Promise<CreateResult> {
  const name = input.name.trim().slice(0, MAX_ORG_NAME);
  if (!name) {
    return { outcome: CreateOutcome.InvalidName };
  }

  try {
    const { orgId } = await deps.createFirstOrg({ userId: input.userId, name });
    await setActiveOrg(db, { userId: input.userId, orgId });
    return { outcome: CreateOutcome.Created, orgId };
  } catch (e) {
    if (e instanceof FreeOrgLimitReachedError) {
      return { outcome: CreateOutcome.FreeLimit };
    }
    throw e;
  }
}
