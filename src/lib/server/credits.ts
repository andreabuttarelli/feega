import type { SupabaseClient } from '@supabase/supabase-js';
import { PLANS } from '$lib/plans';
import { swallow } from '$lib/server/swallow';
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

// ── AI Credits: consumption tracking per billing period ─────────────────────────
// Every AI call logs cost_usd in ai_calls (tagged by org_id via the AsyncLocalStorage
// context). This module reads the org's credit balance and gates spend on it. Every model is stored at 100% of list — Gemini Flash and Nano Banana Pro
// carried a per-plan discount until 2026-08 and no longer do, so the same quota now buys fewer
// looks and fewer stills. Quotas were NOT adjusted for this; that is a separate call.

export type CreditsUsage = {
  used: number;       // credits consumed this period (rounded)
  quota: number;      // plan quota + active grants
  bonus: number;      // sum of active credit_grants
  remaining: number;  // max(0, quota - used)
  periodStart: Date;
  periodEnd: Date;    // periodStart + 1 month
  percent: number;    // used / quota * 100
};

// ── Plan quotas ──────────────────────────────────────────────────────────────────
const FREE_MONTHLY_QUOTA = 0;

const CREDIT_QUOTAS: Record<string, number> = {
  '': FREE_MONTHLY_QUOTA,
  ...Object.fromEntries(PLANS.map((p) => [p.key, p.credits])),
  scale: PLANS.find((p) => p.key === 'pro')?.credits ?? FREE_MONTHLY_QUOTA
};

export function creditQuota(plan: string | null | undefined): number {
  return CREDIT_QUOTAS[plan ?? ''] ?? FREE_MONTHLY_QUOTA;
}

// ── Ledger balance ───────────────────────────────────────────────────────────────
// Il saldo vero: `credit_ledger` sommato (grant − debit, righe non scadute), letto dalla RPC
// `org_credit_balance` — non da `ai_calls` sommato contro una quota fissa (vedi sotto). Ogni
// chiamata AI prezzata scrive già un debito qui (ai-log.ts): questo è l'unico posto che LEGGE
// quel saldo per decidere se una spesa nuova può passare.

/** Il saldo crediti dell'org, dalla RPC `org_credit_balance` (grant − debit, credit_ledger). */
export async function orgCreditBalance(supabase: SupabaseClient, orgId: string): Promise<number> {
  const { data, error } = await supabase.rpc('org_credit_balance', { _org_id: orgId });
  if (error) throw new Error(`org_credit_balance failed: ${error.message}`);
  return Number(data ?? 0);
}

// ── Enforcement ──────────────────────────────────────────────────────────────────

export class CreditsExhaustedError extends Error {
  public usage: CreditsUsage;
  constructor(usage: CreditsUsage) {
    super('AI credits exhausted for this billing period');
    this.name = 'CreditsExhaustedError';
    this.usage = usage;
  }
}

/**
 * Gate: throws CreditsExhaustedError if no credits remain.
 * Call before any AI chokepoint to enforce the quota.
 */
export function assertCreditsAvailable(usage: CreditsUsage): void {
  if (usage.remaining <= 0) {
    throw new CreditsExhaustedError(usage);
  }
}

// ── Self-contained hard gate ─────────────────────────────────────────────────────
// The runaway-spend circuit breaker (incident 2026-07-13: one crash-looping onboarding job
// burned ~$365 in 42h). Called at the top of every expensive flow AND inside renderImage —
// the costly chokepoint — so even a loop nobody anticipated stops at the quota.
// Fail-OPEN by design: a billing outage must never take the product down. The 60s per-org
// cache bounds the DB overhead to ~3 queries per org per minute.

import { createAdminClient } from './supabase-admin';

const gateCache = new Map<string, { usage: CreditsUsage; at: number }>();
const GATE_TTL_MS = 60_000;

function reportFailOpen(orgId: string, err: unknown): void {
  swallow(`credits: allowed org ${orgId} without evaluating its ledger`, err);
}

export async function gateOrgCredits(orgId: string): Promise<void> {
  const { billingProvider } = await import('./billing');
  const provider = await billingProvider();
  await provider.gate('credits', { orgId });
}

export async function gateOrgCreditsCore(orgId: string): Promise<void> {
  const { isCreditExempt } = await import('./ai-log');
  if (isCreditExempt()) return;

  // Fuori dal try di proposito: un rifiuto qui è il cancello che fa il suo mestiere, e non deve
  // finire nel catch che lascia passare.
  const hit = gateCache.get(orgId);
  if (hit && Date.now() - hit.at < GATE_TTL_MS) {
    assertCreditsAvailable(hit.usage);
    return;
  }

  let usage: CreditsUsage;
  try {
    const admin = createAdminClient();
    usage = await ledgerCreditsUsage(admin, orgId);
    gateCache.set(orgId, { usage, at: Date.now() });
  } catch (e) {
    reportFailOpen(orgId, e);
    return;
  }
  assertCreditsAvailable(usage);
}

/**
 * Il saldo `credit_ledger` travestito da `CreditsUsage`, per il cancello e per la cache che già
 * esiste — non un secondo concetto di "quota", solo il saldo vero letto una volta. `quota`/`used`
 * qui sono display: quello che decide è `remaining`, ed è il saldo stesso.
 */
async function ledgerCreditsUsage(supabase: SupabaseClient, orgId: string): Promise<CreditsUsage> {
  const balance = await orgCreditBalance(supabase, orgId);
  const now = new Date();
  return {
    used: 0,
    quota: Math.max(0, balance),
    bonus: 0,
    remaining: Math.max(0, balance),
    periodStart: now,
    periodEnd: now,
    percent: 0
  };
}
