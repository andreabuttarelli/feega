import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { Json } from '$lib/database.types';
import { capture } from '$lib/server/core-usage';

export enum ProductEvent {
  SignupCompleted = 'signup_completed',
  AgentConnected = 'agent_connected',
  TeamInviteSent = 'team_invite_sent',
  TeamInviteAccepted = 'team_invite_accepted',
  PlanUpgraded = 'plan_upgraded',
  PlanDowngraded = 'plan_downgraded',
  PlanCancelled = 'plan_cancelled',
  RevenueRecognized = 'revenue_recognized',
  RevenueRefunded = 'revenue_refunded'
}

export type Money = { amount: number; currency: string; plan: string | null };

type Nothing = Record<string, never>;

export type ProductProps = {
  [ProductEvent.SignupCompleted]: Nothing;
  [ProductEvent.AgentConnected]: { key_id: string };
  [ProductEvent.TeamInviteSent]: { role: string; via: 'email' | 'link' };
  [ProductEvent.TeamInviteAccepted]: { role: string };
  [ProductEvent.PlanUpgraded]: Money & { seats: number };
  [ProductEvent.PlanDowngraded]: Money & { seats: number };
  [ProductEvent.PlanCancelled]: Money;
  [ProductEvent.RevenueRecognized]: Money & { invoice_id: string };
  [ProductEvent.RevenueRefunded]: Money & { charge_id: string };
};

export type EventActor = { userId?: string | null; orgId?: string | null; anonymousId?: string | null };

export type EventRow = { event: ProductEvent; user_id: string | null; org_id: string | null; anonymous_id: string | null; props: Json };

export type EventSink = (row: EventRow) => Promise<{ error: unknown } | void>;

const EVENTS_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/product-events/track.ts'));

const dbSink: EventSink = async (row) => {
  if (!EVENTS_USE) {
    return { error: 'product_events service role use not declared' };
  }
  return createServiceRoleDb(EVENTS_USE).from('product_events').insert(row);
};

export async function track<E extends ProductEvent>(event: E, actor: EventActor, props: ProductProps[E], sink: EventSink = dbSink): Promise<void> {
  const row: EventRow = { event, user_id: actor.userId ?? null, org_id: actor.orgId ?? null, anonymous_id: actor.anonymousId ?? null, props: props as Json };

  capture(actor.userId, event, props, actor.orgId);

  try {
    const out = await sink(row);
    if (out?.error) {
      console.warn('[product-events] not recorded', event, out.error);
    }
  } catch (e) {
    console.warn('[product-events] not recorded', event, e);
  }
}
