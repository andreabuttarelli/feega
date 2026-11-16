import type { SupabaseClient } from '@supabase/supabase-js';
import { swallow } from '$lib/server/swallow';
import { createAdminClient } from '$lib/server/supabase-admin';
import { BillingUnavailableError } from '$lib/billing/contract';
import { usageBreakdown, type ProjectName, type UsageBreakdown, type UsageCall } from '$lib/credits/usage-breakdown';

const USAGE_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export async function recentUsage(supabase: SupabaseClient, orgId: string, now = new Date()): Promise<UsageBreakdown> {
  const since = new Date(now.getTime() - USAGE_WINDOW_DAYS * DAY_MS).toISOString();
  const [calls, projects] = await Promise.all([
    supabase.from('ai_calls').select('operation, actor_kind, project_id, billed_credits, cost_usd').eq('org_id', orgId).gte('created_at', since),
    supabase.from('projects').select('id, name').eq('org_id', orgId)
  ]);
  if (calls.error) {
    throw new Error(`ai_calls usage failed: ${calls.error.message}`);
  }

  return usageBreakdown((calls.data ?? []) as UsageCall[], (projects.data ?? []) as ProjectName[]);
}

export type CreditsUsage = {
  used: number;
  quota: number;
  bonus: number;
  remaining: number;
  periodStart: Date;
  periodEnd: Date;
  percent: number;
};

const ORG_OF_BRAND_TTL_MS = 5 * 60_000;

const orgByBrand = new Map<string, { orgId: string | null; at: number }>();

async function orgOfBrand(supabase: SupabaseClient, brandId: string): Promise<string | null> {
  const hit = orgByBrand.get(brandId);
  if (hit && Date.now() - hit.at < ORG_OF_BRAND_TTL_MS) {
    return hit.orgId;
  }
  const { data, error } = await supabase.from('brands').select('org_id').eq('id', brandId).maybeSingle();
  if (error) {
    throw new Error(`brands lookup failed: ${error.message}`);
  }
  const orgId = (data as { org_id?: string } | null)?.org_id ?? null;
  orgByBrand.set(brandId, { orgId, at: Date.now() });
  return orgId;
}

export async function orgCreditBalance(supabase: SupabaseClient, orgId: string): Promise<number> {
  const { data, error } = await supabase.rpc('org_credit_balance', { _org_id: orgId });
  if (error) throw new Error(`org_credit_balance failed: ${error.message}`);
  return Number(data ?? 0);
}

export class CreditsExhaustedError extends Error {
  public usage: CreditsUsage;
  constructor(usage: CreditsUsage) {
    super('AI credits exhausted for this billing period');
    this.name = 'CreditsExhaustedError';
    this.usage = usage;
  }
}

export function assertCreditsAvailable(usage: CreditsUsage): void {
  if (usage.remaining <= 0) {
    throw new CreditsExhaustedError(usage);
  }
}

export async function gateCredits(brandId: string): Promise<void> {
  const { billingProvider } = await import('./billing');
  const provider = await billingProvider();
  await provider.gate({ brandId });
}

export async function gateOrgCredits(orgId: string): Promise<void> {
  const { billingProvider } = await import('./billing');
  const provider = await billingProvider();
  await provider.gate({ orgId });
}

function refuse(payer: string, err: unknown): never {
  swallow(`credits: refused ${payer}, its balance could not be read`, err);
  throw new BillingUnavailableError(err instanceof Error ? err.message : String(err));
}

async function gateBalance(orgId: string): Promise<CreditsUsage> {
  const { data, error } = await createAdminClient().rpc('credit_gate', { _org_id: orgId });
  if (error) {
    throw new Error(`credit_gate failed: ${error.message}`);
  }
  const balance = Math.max(0, Number(data ?? 0));
  const now = new Date();
  return { used: 0, quota: balance, bonus: 0, remaining: balance, periodStart: now, periodEnd: now, percent: 0 };
}

export async function gateOrgCreditsCore(orgId: string): Promise<void> {
  const { isCreditExempt } = await import('./ai-log');
  if (isCreditExempt()) return;

  const usage = await gateBalance(orgId).catch((e) => refuse(`org ${orgId}`, e));
  assertCreditsAvailable(usage);
}

export async function gateCreditsCore(brandId: string): Promise<void> {
  const { isCreditExempt } = await import('./ai-log');
  if (isCreditExempt()) return;

  const usage = await brandBalance(brandId).catch((e) => refuse(`brand ${brandId}`, e));
  assertCreditsAvailable(usage);
}

async function brandBalance(brandId: string): Promise<CreditsUsage> {
  const orgId = await orgOfBrand(createAdminClient(), brandId);
  if (!orgId) {
    throw new Error(`brand ${brandId} resolves to no org`);
  }
  return gateBalance(orgId);
}
