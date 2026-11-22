import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { isGithubNickname, namesFromAuth } from '$lib/onboarding/provider-name';
import { listMemberships } from '$lib/server/repos/orgs';
import { saveName } from '$lib/server/repos/profiles';
import { ENTRY_DEPS, enterApp, workspaceNameFor } from '$lib/server/tenancy/entry';
import { chooseOrg } from '$lib/server/tenancy/context';
import { renameOrg } from '$lib/server/tenancy/rename-org';
import { OrgRoleName } from '$lib/org-roles';
import { DASHBOARD_PATH } from '$lib/app-routes';

export const ONBOARDING_PATH = '/onboarding';
export const NEXT_PARAM = 'next';

const MAX_PART = 80;
const MAX_ORG_NAME = 80;
const FALLBACK_ORG_NAME = 'my team';
const DEFAULT_ORG_NAMES = ['my workspace'];

export type OnboardingState = {
  orgId: string;
  needsName: boolean;
  needsOrg: boolean;
  first: string;
  last: string;
  orgName: string;
};

export type OnboardingInput = { first: string; last: string; orgName: string };

export enum OnboardingSave {
  Saved = 'saved',
  NameRequired = 'name_required',
  OrgRequired = 'org_required',
  OrgNameDefault = 'org_name_default'
}

export type OnboardingDeps = {
  enterApp: typeof enterApp;
  listMemberships: typeof listMemberships;
  saveName: typeof saveName;
  renameOrg: typeof renameOrg;
};

const ONBOARDING_DEPS: OnboardingDeps = { enterApp, listMemberships, saveName, renameOrg };

export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return DASHBOARD_PATH;
  }
  return value;
}

export function onboardingUrl(next: string): string {
  return `${ONBOARDING_PATH}?${NEXT_PARAM}=${encodeURIComponent(next)}`;
}

export function orgPrefill(first: string): string {
  return first ? `${first}'s team` : FALLBACK_ORG_NAME;
}

function isDefaultOrgName(name: string, user: User): boolean {
  const handle = user.email?.split('@')[0] ?? 'my';
  const known = [...DEFAULT_ORG_NAMES, workspaceNameFor(user), `${handle}'s workspace`];
  return known.some((candidate) => candidate.toLowerCase() === name.trim().toLowerCase());
}

export async function readOnboarding(
  db: Db,
  user: User,
  chosenOrgId: string | null,
  deps: OnboardingDeps = ONBOARDING_DEPS
): Promise<OnboardingState> {
  const { orgId } = await deps.enterApp(db, ENTRY_DEPS, user, chosenOrgId);
  const membership = chooseOrg(await deps.listMemberships(db, user.id), orgId);
  const { data } = await db.from('profiles').select('name').eq('id', user.id).maybeSingle();
  const { first, last } = namesFromAuth(user);

  return {
    orgId,
    needsName: !data?.name || isGithubNickname(user, data.name),
    needsOrg: membership?.role === OrgRoleName.Owner && isDefaultOrgName(membership.org.name, user),
    first,
    last,
    orgName: orgPrefill(first)
  };
}

export async function saveOnboarding(
  db: Db,
  user: User,
  state: Pick<OnboardingState, 'orgId' | 'needsName' | 'needsOrg'>,
  input: OnboardingInput,
  deps: OnboardingDeps = ONBOARDING_DEPS
): Promise<OnboardingSave> {
  const first = input.first.trim().slice(0, MAX_PART);
  const last = input.last.trim().slice(0, MAX_PART);
  const orgName = input.orgName.trim().slice(0, MAX_ORG_NAME);

  if (state.needsName && (!first || !last)) {
    return OnboardingSave.NameRequired;
  }
  if (state.needsOrg && !orgName) {
    return OnboardingSave.OrgRequired;
  }
  if (state.needsOrg && isDefaultOrgName(orgName, user)) {
    return OnboardingSave.OrgNameDefault;
  }

  if (state.needsName) {
    await deps.saveName(db, user.id, `${first} ${last}`);
  }
  if (state.needsOrg) {
    await deps.renameOrg({ orgId: state.orgId, name: orgName });
  }

  return OnboardingSave.Saved;
}

export async function onboardingPathFor(
  db: Db,
  user: User,
  chosenOrgId: string | null,
  next: string,
  deps: OnboardingDeps = ONBOARDING_DEPS
): Promise<string | null> {
  const state = await readOnboarding(db, user, chosenOrgId, deps);
  return state.needsName || state.needsOrg ? onboardingUrl(next) : null;
}
