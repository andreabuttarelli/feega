import type { Db } from '$lib/server/db/client';
import { EDITOR_ROLES, type OrgRole } from '$lib/org-roles';
import { isOrgFree } from '$lib/server/tenancy/free-org-limit';
import { BILLING_PATH } from '$lib/billing-path';

export enum SeatPlan {
  Free = 'free',
  Paid = 'paid'
}

export const SEAT_LIMITS: Record<SeatPlan, number> = {
  [SeatPlan.Free]: 3,
  [SeatPlan.Paid]: Infinity
};

export type SeatUse = { members: string[]; pendingInviteRoles: string[] };

const isEditor = (role: string) => EDITOR_ROLES.includes(role as OrgRole);

export function editorSeatsLeft(plan: SeatPlan, use: SeatUse): number {
  const used = [...use.members, ...use.pendingInviteRoles].filter(isEditor).length;
  return SEAT_LIMITS[plan] - used;
}

export async function seatPlanOf(db: Db, orgId: string): Promise<SeatPlan> {
  return (await isOrgFree(db, orgId)) ? SeatPlan.Free : SeatPlan.Paid;
}

export function seatLimitDetail(plan: SeatPlan) {
  return {
    limit: SEAT_LIMITS[plan],
    upgrade_path: BILLING_PATH,
    message: `Free organisations have ${SEAT_LIMITS[plan]} editor seats. Buy credits on any plan (${BILLING_PATH}) for unlimited editors, or invite as a viewer: viewers are free.`
  };
}

export function needsSeat(role: string): boolean {
  return isEditor(role);
}
