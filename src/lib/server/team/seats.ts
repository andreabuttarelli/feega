import { EDITOR_ROLES, type OrgRole } from '$lib/org-roles';
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

export function seatLimitDetail(plan: SeatPlan) {
  return {
    limit: SEAT_LIMITS[plan],
    upgrade_path: BILLING_PATH,
    message: `Free teams have ${SEAT_LIMITS[plan]} editor. Subscribe (€${PLAN.price} per editor per month, ${BILLING_PATH}) to add editors, or invite as a viewer: viewers are free.`
  };
}

export const PAST_DUE_DETAIL = {
  upgrade_path: BILLING_PATH,
  message: `The team's payment is past due. Editors can be added again once it is paid (${BILLING_PATH}); viewers are free.`
};

export const BILLING_ONLY_DETAIL = {
  message: `An editor is a paid seat (€${PLAN.price} per month). Only the team owner can add one; you can invite viewers for free.`
};

export function needsSeat(role: string): boolean {
  return isEditor(role);
}
