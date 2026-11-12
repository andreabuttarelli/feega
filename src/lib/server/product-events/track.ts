import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { Json } from '$lib/database.types';
import type { CanvasPerfProps } from '$lib/server/canvas-perf';

export enum ProductEvent {
  LandingPromptSent = 'landing_prompt_sent',
  LoginStarted = 'login_started',
  SignupCompleted = 'signup_completed',
  HandoffResumed = 'handoff_resumed',
  CanvasCreated = 'canvas_created',
  AgentStarted = 'agent_started',
  AgentFirstOutput = 'agent_first_output',
  AgentFailed = 'agent_failed',
  CreditsExhausted = 'credits_exhausted',
  ImportFailed = 'import_failed',
  CanvasPerf = 'canvas_perf',
  UpgradeOfferShown = 'upgrade_offer_shown',
  UpgradeOfferClicked = 'upgrade_offer_clicked',
  UpgradeOfferRedeemed = 'upgrade_offer_redeemed'
}

type Nothing = Record<string, never>;

export type ProductProps = {
  [ProductEvent.LandingPromptSent]: { kind: string; source: string | null };
  [ProductEvent.LoginStarted]: Nothing;
  [ProductEvent.SignupCompleted]: Nothing;
  [ProductEvent.HandoffResumed]: { autostart: boolean; viaLogin: boolean };
  [ProductEvent.CanvasCreated]: { kind: string; source: string | null };
  [ProductEvent.AgentStarted]: { model: string };
  [ProductEvent.AgentFirstOutput]: Nothing;
  [ProductEvent.AgentFailed]: { code: string };
  [ProductEvent.CreditsExhausted]: Nothing;
  [ProductEvent.ImportFailed]: { source: string; error: string };
  [ProductEvent.CanvasPerf]: CanvasPerfProps;
  [ProductEvent.UpgradeOfferShown]: { reason: string; created: boolean };
  [ProductEvent.UpgradeOfferClicked]: Nothing;
  [ProductEvent.UpgradeOfferRedeemed]: Nothing;
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

  try {
    const out = await sink(row);
    if (out?.error) {
      console.warn('[product-events] not recorded', event, out.error);
    }
  } catch (e) {
    console.warn('[product-events] not recorded', event, e);
  }
}
