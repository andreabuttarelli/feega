import type { Db } from '$lib/server/db/client';
import { EDITOR_ROLES, type OrgRole } from '$lib/org-roles';
import { billingTierOf, BillingTier } from '$lib/server/billing-tier';
import { BILLING_PATH } from '$lib/billing-path';
import { FREE_EDITOR_SEATS, PLAN } from '$lib/credit-ladder';

export enum SeatPlan {
  Free = 'free',
  Paid = 'paid'
}

export const SEAT_LIMITS: Record<SeatPlan, number> = {
  [SeatPlan.Free]: FREE_EDITOR_SEATS,
  [SeatPlan.Paid]: Infinity
};

export type SeatUse = { members: string[]; pendingInviteRoles: string[] };

const isEditor = (role: string) => EDITOR_ROLES.includes(role as OrgRole);

export function editorSeatsLeft(plan: SeatPlan, use: SeatUse): number {
  const used = [...use.members, ...use.pendingInviteRoles].filter(isEditor).length;
  return SEAT_LIMITS[plan] - used;
}

export async function seatPlanOf(db: Db, orgId: string): Promise<SeatPlan> {
  return (await billingTierOf(db, orgId)) === BillingTier.Paid ? SeatPlan.Paid : SeatPlan.Free;
}

export function seatLimitDetail(plan: SeatPlan) {
  return {
    limit: SEAT_LIMITS[plan],
    upgrade_path: BILLING_PATH,
    message: `Free teams have ${SEAT_LIMITS[plan]} editor. Subscribe (€${PLAN.price} per editor per month, ${BILLING_PATH}) to add editors, or invite as a viewer: viewers are free.`
  };
}

export function needsSeat(role: string): boolean {
  return isEditor(role);
}
