import type { BillingProvider } from '$lib/billing/contract';
import { creditQuota, gateOrgCreditsCore } from '$lib/server/credits';
import { isTopPlan, plansAbove, postQuota } from '$lib/server/plans';

export const dazeroBillingProvider: BillingProvider = {
  kind: 'dazero',

  async gate(kind, ctx) {
    if (kind !== 'credits') return;
    if (ctx.orgId) return gateOrgCreditsCore(ctx.orgId);
  },

  async quota(kind, ctx) {
    return kind === 'credits' ? creditQuota(ctx.plan ?? null) : postQuota(ctx.plan ?? null);
  },

  plansAbove(plan) {
    return plansAbove(plan);
  },

  isTopPlan(plan) {
    return isTopPlan(plan);
  }
};
