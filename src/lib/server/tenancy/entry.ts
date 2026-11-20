import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { ensureProfile } from '$lib/server/repos/profiles';
import { listMemberships } from '$lib/server/repos/orgs';
import { createFirstOrg } from '$lib/server/tenancy/bootstrap';
import { chooseOrg } from '$lib/server/tenancy/context';

const DEFAULT_WORKSPACE_NAME = 'My workspace';

export const DASHBOARD_PATH = '/app';

export type Entry = { orgId: string };

export type EntryDeps = {
  ensureProfile: typeof ensureProfile;
  listMemberships: typeof listMemberships;
  createFirstOrg: typeof createFirstOrg;
};

export const ENTRY_DEPS: EntryDeps = { ensureProfile, listMemberships, createFirstOrg };

export function workspaceNameFor(user: User): string {
  return user.email?.split('@')[0] || DEFAULT_WORKSPACE_NAME;
}

type FirstOrgResult = Awaited<ReturnType<EntryDeps['createFirstOrg']>>;

const firstOrgFlights = new Map<string, Promise<FirstOrgResult>>();

function firstOrgOnce(create: EntryDeps['createFirstOrg'], input: { userId: string; name: string }): Promise<FirstOrgResult> {
  const pending = firstOrgFlights.get(input.userId);
  if (pending) {
    return pending;
  }

  const flight = create(input).finally(() => firstOrgFlights.delete(input.userId));
  firstOrgFlights.set(input.userId, flight);
  return flight;
}

export async function enterApp(db: Db, deps: EntryDeps, user: User, chosenOrgId: string | null = null): Promise<Entry> {
  await deps.ensureProfile(db, user);

  const membership = chooseOrg(await deps.listMemberships(db, user.id), chosenOrgId);
  if (membership) {
    return { orgId: membership.org.id };
  }

  const { orgId } = await firstOrgOnce(deps.createFirstOrg, { userId: user.id, name: workspaceNameFor(user) });
  return { orgId };
}

export async function homePathFor(db: Db, deps: EntryDeps, user: User, chosenOrgId: string | null = null): Promise<string> {
  await enterApp(db, deps, user, chosenOrgId);
  return DASHBOARD_PATH;
}
