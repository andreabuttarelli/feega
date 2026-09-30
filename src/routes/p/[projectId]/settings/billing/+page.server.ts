import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { orgCreditBalance } from '$lib/server/credits';
import { billedCreditsFor, CREDIT_LADDER, rungFor } from '$lib/credit-ladder';
import { isOrgOwner, orgBillingById } from '$lib/server/org-billing';
import { appOrigin } from '$lib/server/app-url';
import { billingGrantsReady } from '$lib/server/billing-readiness';
import { latestRefund, type ProcessingFeeOf } from '$lib/server/refund-status';
import { supportEmail } from '$lib/server/support-config';
import {
  billingPortal,
  upgrade,
  applyRetention,
  cancelPlan,
  settingsScope
} from '$lib/server/settings-actions';
import { billingPath, checkoutReturnUrls, checkoutOutcomeOf } from '$lib/billing-path';

const PURCHASES_NOT_READY = 'Purchases open soon.';

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

  const [balance, currentPlanUsd, refund] = await Promise.all([
    orgCreditBalance(supabase, orgId),
    currentPlanOf(supabase, orgId),
    refundOf(supabase, orgId)
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
    purchasesReady,
    refund,
    supportEmail: supportEmail()
  };
};

async function refundOf(supabase: App.Locals['supabase'], orgId: string) {
  const feeOf: ProcessingFeeOf = async (payment) => (await stripeApi()).paymentProcessingFee(payment);

  try {
    const refund = await latestRefund(supabase, orgId, new Date(), feeOf);
    if (!refund) {
      return null;
    }

    return {
      eligible: refund.eligible,
      amount: refund.amount,
      until: refund.until?.toISOString() ?? null,
      maxCreditsUsable: refund.maxCreditsUsable
    };
  } catch {
    return null;
  }
}

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

async function buyOneTime({ request, url, params, locals: { supabase } }: RequestEvent) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw redirect(303, '/login');

  const scope = await settingsScope(supabase, params.projectId);
  if (!scope) return fail(404, { billingError: 'No organization' });
  const { orgId } = scope;

  if (!(await isOrgOwner(supabase, orgId, user.id))) {
    return fail(403, { billingError: 'Owner only' });
  }

  if (!(await billingGrantsReady(supabase))) {
    return fail(409, { billingError: PURCHASES_NOT_READY });
  }

  const data = await request.formData();
  const usd = Number(data.get('usd') ?? '');
  const rung = rungFor(usd);
  if (!rung) return fail(400, { billingError: 'Unknown one-time pack' });

  const { data: orgRow } = await supabase
    .from('orgs')
    .select('id, name, stripe_customer_id')
    .eq('id', orgId)
    .maybeSingle();
  const org = orgRow as { id: string; name: string; stripe_customer_id: string | null } | null;
  if (!org) return fail(404, { billingError: 'Organization not found' });

  const returnUrl = `${appOrigin(url)}${billingPath(scope.projectId)}`;

  let checkoutUrl: string;
  try {
    const { ensureOrgCustomer, createOneTimeCreditCheckout } = await stripeApi();
    const customerId = await ensureOrgCustomer(org);
    checkoutUrl = await createOneTimeCreditCheckout({
      customerId,
      orgId: org.id,
      price: rung.price,
      credits: rung.credits,
      ...checkoutReturnUrls(returnUrl)
    });
  } catch (e) {
    return fail(500, { billingError: e instanceof Error ? e.message : 'Could not start the purchase' });
  }
  throw redirect(303, checkoutUrl);
}

export const actions: Actions = {
  billingPortal,
  upgrade,
  applyRetention,
  cancelPlan,
  buyOneTime
};
