import type { SupabaseClient } from '@supabase/supabase-js';
import { PLANS } from '$lib/plans';
import { swallow } from '$lib/server/swallow';
import { billedCreditsFor } from '$lib/credit-ladder';
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
// Every AI call logs cost_usd in ai_calls (tagged by brand_id via the AsyncLocalStorage
// context). This module sums those costs into "credits" with `billedCreditsFor`
// (credit-ladder.ts) — the same rate `ai-log.ts` bills each row at — and enforces the per-plan
// monthly quota. Every model is stored at 100% of list — Gemini Flash and Nano Banana Pro
// carried a per-plan discount until 2026-08 and no longer do, so the same quota now buys fewer
// looks and fewer stills. Quotas were NOT adjusted for this; that is a separate call.

export type Brand = {
  id: string;
  plan: string | null;
  activated_at: string | null;
  status: string;
};

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

// ── Date helpers ─────────────────────────────────────────────────────────────────

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
}

/**
 * Find the start of the current billing period: the most recent monthly anniversary of
 * `anchor` that is <= `now`. E.g. anchor = Jan 15, now = Mar 3 → start = Feb 15.
 */
function shiftToAnchor(anchor: Date, now: Date): Date {
  const anchorDay = anchor.getUTCDate();
  // Start from the anchor's month in the same year, then walk forward until we pass `now`.
  let candidate = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchorDay));
  // If candidate is in the future relative to now, we need to go back.
  // But it's easier to walk forward from (now - 1 month) to find the right period.
  // Strategy: compute the month difference, then verify.
  const nowTime = now.getTime();
  // Fast path: anchor is in the current month and already passed.
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), anchorDay));
  if (thisMonth.getTime() <= nowTime) return thisMonth;
  // Otherwise the period started last month.
  return addMonths(thisMonth, -1);
}

// ── Billing period ───────────────────────────────────────────────────────────────

/**
 * Current billing window: [period anchor, +1 month).
 * The new schema (`orgs`, `brands`) carries no subscription, so there is no anchor to read live
 * anymore — every period is the calendar month, in UTC. `activated_at` and a Stripe anchor are
 * kept as optional inputs so old callers still compile; neither has a column to come from today.
 */
export function currentBillingPeriod(
  brand: Pick<Brand, 'activated_at'>,
  stripePeriodStart?: Date | null
): { start: Date; end: Date } {
  const anchor = stripePeriodStart
    ?? (brand.activated_at ? new Date(brand.activated_at) : monthStart(new Date()));
  const start = shiftToAnchor(anchor, new Date());
  const end = addMonths(start, 1);
  return { start, end };
}

// ── Org scope ────────────────────────────────────────────────────────────────────
// Spend is pooled at the ORG, not the brand: every brand under an org draws from the same
// ai_calls sum. `getCreditsUsage` reads org-first and falls back to the brand alone only when
// the brand row itself cannot be resolved to an org.

const ORG_BILLING_TTL_MS = 5 * 60_000;

/**
 * `orgs` carries no billing columns on the new schema — no plan, no subscription, no period
 * anchor — and neither does `brands` anymore. Billing has no home yet; see the module doc at the
 * top. `plan`/`activatedAt` are kept in the shape (always null today) so `creditQuota`/
 * `currentBillingPeriod` keep one signature instead of forking for "before" and "after" billing
 * lands somewhere. `billingBrandId` is gone with them — there is no brand left to anchor a period on.
 */
export type OrgBilling = {
  orgId: string;
  plan: string | null;
  activatedAt: string | null;
  brandIds: string[];
};

const orgBillingByBrand = new Map<string, { value: OrgBilling | null; at: number }>();

/** The org a brand belongs to, and every sibling brand under it (the pool spend is shared over). */
export async function resolveOrgBilling(
  supabase: SupabaseClient,
  brandId: string
): Promise<OrgBilling | null> {
  const hit = orgBillingByBrand.get(brandId);
  if (hit && Date.now() - hit.at < ORG_BILLING_TTL_MS) return hit.value;

  const value = await readOrgBilling(supabase, brandId);
  orgBillingByBrand.set(brandId, { value, at: Date.now() });
  return value;
}

async function readOrgBilling(
  supabase: SupabaseClient,
  brandId: string
): Promise<OrgBilling | null> {
  const { data: brand } = await supabase
    .from('brands')
    .select('org_id')
    .eq('id', brandId)
    .maybeSingle();
  const orgId = (brand as { org_id?: string } | null)?.org_id;
  if (!orgId) return null;

  return readOrgBillingById(supabase, orgId);
}

/** The same reading for a caller that already holds the org and has no brand to reach it through. */
export async function readOrgBillingById(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgBilling | null> {
  const { data: org } = await supabase.from('orgs').select('id').eq('id', orgId).maybeSingle();
  if (!org) return null;

  const { data: brands } = await supabase.from('brands').select('id').eq('org_id', orgId);

  return {
    orgId,
    plan: null,
    activatedAt: null,
    brandIds: (brands ?? []).map((b) => (b as { id: string }).id)
  };
}

/**
 * The plan the org bills on. Always null today — kept as a function (not inlined at the two call
 * sites) so the day billing gets a real column, one place answers instead of two.
 */
export async function orgPlanForBrand(
  supabase: SupabaseClient,
  brandId: string
): Promise<string | null> {
  return (await resolveOrgBilling(supabase, brandId))?.plan ?? null;
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

// ── Usage query ──────────────────────────────────────────────────────────────────

/**
 * Sum `cost_usd` from `ai_calls` in the current billing period for one scope (an org, or a
 * single brand when no org is in reach). PostgREST aggregates are off, so the sum runs in JS —
 * the row set is one billing period of one org's calls, not the whole table.
 */
async function sumAiCostUsd(
  supabase: SupabaseClient,
  scope: { orgId: string } | { brandId: string },
  start: Date,
  end: Date
): Promise<number> {
  let query = supabase
    .from('ai_calls')
    .select('cost_usd')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());
  query = 'orgId' in scope ? query.eq('org_id', scope.orgId) : query.eq('brand_id', scope.brandId);

  const { data, error } = await query;
  if (error) throw new Error(`ai_calls sum failed: ${error.message}`);

  return (data ?? []).reduce((sum: number, row: { cost_usd: number | null }) => sum + (row.cost_usd ?? 0), 0);
}

/**
 * Sum cost_usd × 100 from ai_calls in the current billing period for this brand.
 * Quota is always the free-tier quota: `orgs`/`brands` carry no plan column on the new schema,
 * so there is nothing to read a paid quota from — see the module doc. A read failure THROWS
 * (never returns `used: 0`): the caller's fail-open catch is the only place that decides to let
 * a spend through despite an unreadable ledger, and it reports every time it does.
 */
export async function getCreditsUsage(
  supabase: SupabaseClient,
  brand: Brand
): Promise<CreditsUsage> {
  const org = await resolveOrgBilling(supabase, brand.id);
  // No org in reach (a brand row that isn't there): answer for the brand alone.
  if (!org) return brandCreditsUsage(supabase, brand);

  return orgCreditsUsage(supabase, org, brand.activated_at);
}

/**
 * The pool as the org sees it. Split out of getCreditsUsage unchanged: a brand-free render has
 * no brand row to carry an anchor, and everything below the org already ignored the brand.
 */
export async function orgCreditsUsage(
  supabase: SupabaseClient,
  org: OrgBilling,
  activatedAtFallback: string | null = null
): Promise<CreditsUsage> {
  const { start, end } = currentBillingPeriod({ activated_at: org.activatedAt ?? activatedAtFallback });
  // creditQuota(null), not creditQuota(org.plan): org.plan is always null on the new schema (see
  // the OrgBilling doc above) — reading it here would let a caller-constructed OrgBilling with a
  // stale plan string buy a bigger quota than any org can actually prove it is entitled to.
  const quota = creditQuota(null);

  const spentUsd = await sumAiCostUsd(supabase, { orgId: org.orgId }, start, end);
  const used = billedCreditsFor(spentUsd);

  return {
    used,
    quota,
    bonus: 0,
    remaining: Math.max(0, quota - used),
    periodStart: start,
    periodEnd: end,
    percent: quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0
  };
}

/** The brand-only reading, kept whole for the case where no org can be resolved. */
async function brandCreditsUsage(
  supabase: SupabaseClient,
  brand: Brand
): Promise<CreditsUsage> {
  const { start, end } = currentBillingPeriod(brand);
  const quota = creditQuota(brand.plan);

  const spentUsd = await sumAiCostUsd(supabase, { brandId: brand.id }, start, end);
  const used = billedCreditsFor(spentUsd);

  return {
    used,
    quota,
    bonus: 0,
    remaining: Math.max(0, quota - used),
    periodStart: start,
    periodEnd: end,
    percent: quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0
  };
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
// burned ~$365 in 42h). Fail-CLOSED: a balance that cannot be read refuses the spend, for paying
// and free orgs alike — a week of unmetered AI is what failing open cost.

import { createAdminClient } from './supabase-admin';
import { BillingUnavailableError } from '$lib/billing/contract';

export async function gateCredits(brandId: string): Promise<void> {
  const { billingProvider } = await import('./billing');
  const provider = await billingProvider();
  await provider.gate('credits', { brandId });
}

export async function gateOrgCredits(orgId: string): Promise<void> {
  const { billingProvider } = await import('./billing');
  const provider = await billingProvider();
  await provider.gate('credits', { orgId });
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
  const org = await resolveOrgBilling(createAdminClient(), brandId);
  if (!org) {
    throw new Error(`brand ${brandId} resolves to no org`);
  }
  return gateBalance(org.orgId);
}
