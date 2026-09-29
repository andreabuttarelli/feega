import type { Db } from '$lib/server/db/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isOrgOwner } from './org-billing';

export enum BillingTier {
  Free = 'free',
  Paid = 'paid'
}

export const UNCENSORED_ENTITLEMENT: Readonly<Record<BillingTier, boolean>> = {
  [BillingTier.Free]: false,
  [BillingTier.Paid]: true
};

export const UNCENSORED_POLICY_VERSION = '2026-09-29';

export type UncensoredReason = 'enabled' | 'not_opted_in' | 'plan_not_entitled';

export type UncensoredAccess = {
  allowed: boolean;
  reason: UncensoredReason;
  entitled: boolean;
  optIn: { enabledBy: string; enabledAt: string } | null;
};

export const NO_UNCENSORED_ACCESS: UncensoredAccess = { allowed: false, reason: 'not_opted_in', entitled: false, optIn: null };

type OptInRow = { enabled_by: string; enabled_at: string; disabled_at: string | null };

function untyped(db: Db): SupabaseClient {
  return db as unknown as SupabaseClient;
}

async function tierOf(db: Db, orgId: string): Promise<BillingTier> {
  const { data } = await untyped(db).from('orgs').select('id, stripe_subscription_id').eq('id', orgId).maybeSingle();
  return (data as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id ? BillingTier.Paid : BillingTier.Free;
}

async function activeOptIn(db: Db, orgId: string): Promise<OptInRow | null> {
  const { data } = await untyped(db)
    .from('org_uncensored_optins')
    .select('enabled_by, enabled_at, disabled_at')
    .eq('org_id', orgId)
    .maybeSingle();
  const row = data as OptInRow | null;
  return row && !row.disabled_at ? row : null;
}

export async function uncensoredAccess(db: Db, orgId: string): Promise<UncensoredAccess> {
  const [tier, optIn] = await Promise.all([tierOf(db, orgId), activeOptIn(db, orgId)]);
  const entitled = UNCENSORED_ENTITLEMENT[tier];
  const recorded = optIn ? { enabledBy: optIn.enabled_by, enabledAt: optIn.enabled_at } : null;

  if (!entitled) {
    return { allowed: false, reason: 'plan_not_entitled', entitled, optIn: recorded };
  }
  if (!recorded) {
    return { allowed: false, reason: 'not_opted_in', entitled, optIn: null };
  }
  return { allowed: true, reason: 'enabled', entitled, optIn: recorded };
}

export type OptInOutcome = { ok: true } | { ok: false; error: 'owner_only' | 'confirmation_required' | 'plan_not_entitled' | string };

export async function enableUncensored(
  db: Db,
  input: { orgId: string; userId: string; attestedAdult: boolean; acceptedPolicy: boolean }
): Promise<OptInOutcome> {
  if (!input.attestedAdult || !input.acceptedPolicy) {
    return { ok: false, error: 'confirmation_required' };
  }
  if (!(await isOrgOwner(untyped(db), input.orgId, input.userId))) {
    return { ok: false, error: 'owner_only' };
  }
  if (!UNCENSORED_ENTITLEMENT[await tierOf(db, input.orgId)]) {
    return { ok: false, error: 'plan_not_entitled' };
  }

  const { error } = await untyped(db).from('org_uncensored_optins').upsert({
    org_id: input.orgId,
    enabled_by: input.userId,
    enabled_at: new Date().toISOString(),
    attested_adult: true,
    policy_version: UNCENSORED_POLICY_VERSION,
    disabled_at: null,
    disabled_by: null
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function disableUncensored(db: Db, input: { orgId: string; userId: string }): Promise<OptInOutcome> {
  if (!(await isOrgOwner(untyped(db), input.orgId, input.userId))) {
    return { ok: false, error: 'owner_only' };
  }
  const { error } = await untyped(db)
    .from('org_uncensored_optins')
    .update({ disabled_at: new Date().toISOString(), disabled_by: input.userId })
    .eq('org_id', input.orgId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function isUncensoredModel(db: Db, modelId: string | null | undefined): Promise<boolean> {
  if (!modelId) {
    return false;
  }
  const { data } = await untyped(db).from('ai_models').select('uncensored').eq('id', modelId).maybeSingle();
  return (data as { uncensored?: boolean } | null)?.uncensored === true;
}

export function visibleChoices<C extends { uncensored?: boolean }>(choices: readonly C[], access: { allowed: boolean }): C[] {
  return access.allowed ? [...choices] : choices.filter((choice) => !choice.uncensored);
}

export function visibleCatalogue<K extends string, M extends { choices: readonly { uncensored?: boolean }[] }>(
  catalogue: Record<K, M>,
  access: { allowed: boolean }
): Record<K, M> {
  return Object.fromEntries(
    Object.entries<M>(catalogue).map(([medium, entry]) => [medium, { ...entry, choices: visibleChoices(entry.choices, access) }])
  ) as unknown as Record<K, M>;
}

export enum PersonaMark {
  On = 'on',
  Off = 'off'
}

const ADULT_AGE = 18;
const AI_PERSONA_SOURCE = 'generated';

type PersonaRow = { org_id: string | null; source: string; age: number | null };

function personaProblem(row: PersonaRow | null, orgId: string): string | null {
  if (!row || row.org_id !== orgId || row.source !== AI_PERSONA_SOURCE) {
    return 'not_an_ai_persona';
  }
  return row.age !== null && row.age >= ADULT_AGE ? null : 'not_an_adult';
}

export async function markAdultPersona(
  db: Db,
  input: { orgId: string; userId: string; influencerId: string; mark: PersonaMark }
): Promise<OptInOutcome> {
  if (!(await isOrgOwner(untyped(db), input.orgId, input.userId))) {
    return { ok: false, error: 'owner_only' };
  }

  if (input.mark === PersonaMark.On) {
    const { data } = await untyped(db).from('influencers').select('org_id, source, age').eq('id', input.influencerId).maybeSingle();
    const problem = personaProblem(data as PersonaRow | null, input.orgId);
    if (problem) {
      return { ok: false, error: problem };
    }
  }

  const { error } = await untyped(db)
    .from('influencers')
    .update({ adult_persona_at: input.mark === PersonaMark.On ? new Date().toISOString() : null })
    .eq('org_id', input.orgId)
    .eq('id', input.influencerId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
