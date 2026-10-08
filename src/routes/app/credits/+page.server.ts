import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { orgCreditBalance } from '$lib/server/credits';
import { billedCreditsFor, CREDIT_LADDER } from '$lib/credit-ladder';
import { orgBillingById } from '$lib/server/org-billing';
import { billingGrantsReady } from '$lib/server/billing-readiness';
import {
  billingPortal,
  upgrade,
  applyRetention,
  cancelPlan,
  buyOneTime
} from '$lib/server/settings-actions';
import { checkoutOutcomeOf } from '$lib/billing-path';

const stripeApi = () => import('$lib/server/stripe');

type OrgRow = { id: string; name: string; stripe_customer_id: string | null };
type BrandRow = { id: string; name: string; slug: string };

export const load: PageServerLoad = async ({ parent, url, locals: { supabase } }) => {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw redirect(303, '/login');

  const orgId = (await parent()).org.id;

  const [{ data: orgData }, { data: membership }, { data: brandRows }, { data: atRiskRows }, purchasesReady] =
    await Promise.all([
      supabase.from('orgs').select('id, name, stripe_customer_id').eq('id', orgId).maybeSingle(),
      supabase.from('orgs_members').select('role').eq('org_id', orgId).eq('user_id', user.id).maybeSingle(),
      supabase.from('brands').select('id, name, slug').eq('org_id', orgId),
      supabase
        .from('org_credits_at_risk')
        .select('expiring_credits, next_expiry')
        .eq('org_id', orgId)
        .order('next_expiry'),
      billingGrantsReady(supabase)
    ]);
  const org = orgData as OrgRow | null;
  if (!org) throw error(404, 'Organization not found');

  const brands = (brandRows ?? []) as BrandRow[];
  const atRisk = ((atRiskRows ?? []) as { next_expiry: string | null; expiring_credits: number | null }[])
    .filter((row): row is { next_expiry: string; expiring_credits: number } => row.next_expiry != null)
    .map((row) => ({
      expiresAt: row.next_expiry,
      amount: row.expiring_credits
    }));

  const [balance, currentPlanUsd] = await Promise.all([
    orgCreditBalance(supabase, orgId),
    currentPlanOf(supabase, orgId)
  ]);

  const spends = await Promise.all(
    brands.map(async (b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      credits: billedCreditsFor(await sumBrandCostUsd(supabase, b.id))
    }))
  );

  return {
    org: { id: org.id, name: org.name },
    credits: { balance, ladder: CREDIT_LADDER, atRisk },
    brands: spends,
    hasBilling: !!org.stripe_customer_id,
    currentPlanUsd,
    checkoutOutcome: checkoutOutcomeOf(url),
    isOwner: (membership as { role?: string } | null)?.role === 'owner',
    purchasesReady
  };
};

async function currentPlanOf(supabase: App.Locals['supabase'], orgId: string): Promise<number | null> {
  const billing = await orgBillingById(supabase, orgId);
  if (!billing?.subscriptionId) {
    return null;
  }

  try {
    const { subscribedRungPrice } = await stripeApi();
    return await subscribedRungPrice(billing.subscriptionId);
  } catch {
    return null;
  }
}

async function sumBrandCostUsd(supabase: App.Locals['supabase'], brandId: string): Promise<number> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const { data } = await supabase
    .from('ai_calls')
    .select('cost_usd')
    .eq('brand_id', brandId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  return (data ?? []).reduce((sum: number, row: { cost_usd: number | null }) => sum + (row.cost_usd ?? 0), 0);
}

export const actions: Actions = {
  billingPortal,
  upgrade,
  applyRetention,
  cancelPlan,
  buyOneTime
};
