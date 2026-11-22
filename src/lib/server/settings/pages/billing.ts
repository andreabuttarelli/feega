import type { SharedEvent } from '../event';
import type { Db } from '$lib/server/db/client';
import { BillingPlan } from '$lib/billing-plan';
import { OrgAction, can, type OrgRole } from '$lib/org-roles';
import { seatStatus } from '$lib/server/team/seat-billing';

export const load = async ({ parent, locals }: SharedEvent) => {
  const { org } = await parent();
  const db = (await locals.db()) as Db;
  const seats = await seatStatus(db, org.id);

  return {
    plan: seats.paid ? BillingPlan.Cloud : BillingPlan.Free,
    canManage: can(org.role as OrgRole, OrgAction.Billing),
    editors: seats.editors,
    seatsPaid: seats.paid ? (seats.seatsPaid ?? seats.editors) : 0,
    renewsAt: seats.paid ? (seats.renewsAt ?? seats.seatsPaidUntil) : null,
    endsAt: seats.endsAt,
    interval: seats.paid ? seats.interval : null,
    pastDue: seats.pastDue || seats.unpaid
  };
};
