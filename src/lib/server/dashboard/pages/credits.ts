import { error, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad as PageServerLoad } from '@sveltejs/kit';
import { orgCreditBalance, recentUsage } from '$lib/server/credits';
import { PLAN, planForLookupKey, TOP_UPS, type Plan } from '$lib/credit-ladder';
import { orgBillingById } from '$lib/server/org-billing';
import { billingGrantsReady } from '$lib/server/billing-readiness';
import {
  billingPortal,
  subscribe,
  applyRetention,
  cancelPlan,
  buyOneTime
} from '$lib/server/settings-actions';
import { checkoutOutcomeOf } from '$lib/billing-path';
import { billingChannelOf, storeBillingOf } from '$lib/billing-channel';
import { env } from '$env/dynamic/private';
import { seatStatus } from '$lib/server/team/seat-billing';
import { agentEditUsage } from '$lib/server/agent-edits/cap';
import type { Db } from '$lib/server/db/client';

const stripeApi = () => import('$lib/server/stripe');

type OrgRow = { id: string; name: string; stripe_customer_id: string | null };
const NO_USAGE = { total: 0, byProject: [], byKind: [] };

export const load = async ({ parent, url, request, locals: { supabase } }: Parameters<PageServerLoad>[0]) => {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw redirect(303, '/login');

  const orgId = (await parent()).org.id;

  const [{ data: orgData }, { data: membership }, purchasesReady] = await Promise.all([
    supabase.from('orgs').select('id, name, stripe_customer_id').eq('id', orgId).maybeSingle(),
    supabase.from('orgs_members').select('role').eq('org_id', orgId).eq('user_id', user.id).maybeSingle(),
    billingGrantsReady(supabase)
  ]);
  const org = orgData as OrgRow | null;
  if (!org) throw error(404, 'Organization not found');

  const [balance, currentPlan, seats, agentEdits, usage] = await Promise.all([
    orgCreditBalance(supabase, orgId),
    currentPlanOf(supabase, orgId),
    seatStatus(supabase as unknown as Db, orgId).catch((e) => {
      console.error('[seats] seat state unreadable on the credits page', orgId, e);
      return null;
    }),
    agentEditUsage(supabase as unknown as Db, orgId),
    recentUsage(supabase, orgId).catch((e) => {
      console.error('[credits] usage unreadable on the credits page', orgId, e);
      return NO_USAGE;
    })
  ]);

  return {
    org: { id: org.id, name: org.name },
    credits: { balance },
    plan: PLAN,
    topUps: TOP_UPS,
    usage,
    hasBilling: !!org.stripe_customer_id,
    currentPlan,
    seats,
    agentEdits,
    checkoutOutcome: checkoutOutcomeOf(url),
    isOwner: (membership as { role?: string } | null)?.role === 'owner',
    purchasesReady,
    billingChannel: billingChannelOf(request.headers.get('user-agent'), storeBillingOf(env.NATIVE_STORE_BILLING))
  };
};

type StorePlanRow = { store_plan_product: string | null; store_plan_expires_at: string | null };

async function storePlanOf(supabase: App.Locals['supabase'], orgId: string): Promise<Plan | null> {
  const { data } = await supabase
    .from('orgs')
    .select('store_plan_product, store_plan_expires_at')
    .eq('id', orgId)
    .maybeSingle();
  const plan = data as StorePlanRow | null;
  const active = plan?.store_plan_expires_at && new Date(plan.store_plan_expires_at).getTime() > Date.now();
  return active ? (planForLookupKey(plan.store_plan_product) ?? null) : null;
}

async function currentPlanOf(supabase: App.Locals['supabase'], orgId: string): Promise<Plan | null> {
  const storePlan = await storePlanOf(supabase, orgId);
  if (storePlan) {
    return storePlan;
  }

  const billing = await orgBillingById(supabase, orgId);
  if (!billing?.subscriptionId) {
    return null;
  }

  try {
    const { subscribedPlan } = await stripeApi();
    return await subscribedPlan(billing.subscriptionId);
  } catch {
    return null;
  }
}

export const actions: Actions = {
  billingPortal,
  subscribe,
  applyRetention,
  cancelPlan,
  buyOneTime
};

export type CreditsData = Awaited<ReturnType<typeof load>>;
