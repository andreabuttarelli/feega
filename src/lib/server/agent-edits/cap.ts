import { json } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { billingTierOf, BillingTier } from '$lib/server/billing-tier';
import { FREE_AGENT_LAYERS_PER_WEEK, PLAN } from '$lib/credit-ladder';
import { BILLING_PATH } from '$lib/billing-path';

export const AGENT_EDIT_CAP = 'agent_edit_cap';

export type AgentEditCap = {
  error: typeof AGENT_EDIT_CAP;
  used: number;
  limit: number;
  resets_at: string;
  upgrade_path: string;
  message: string;
};

const WEEK_MS = 7 * 86_400_000;
const HTTP_PAYMENT_REQUIRED = 402;
const AGENT = 'agent';
const LAYER_EVENTS = ['node.create', 'node.update', 'node.delete'];

type Stamp = { created_at: string };

async function agentStamps(db: Db, orgId: string, since: string): Promise<Stamp[]> {
  const client = db as unknown as SupabaseClient;
  const window = (table: string) => client.from(table).select('created_at').eq('org_id', orgId).eq('actor_kind', AGENT).gte('created_at', since);
  const [events, revisions] = await Promise.all([
    window('canvas_events').in('kind', LAYER_EVENTS).order('created_at').limit(FREE_AGENT_LAYERS_PER_WEEK),
    window('motion_revisions').order('created_at').limit(FREE_AGENT_LAYERS_PER_WEEK)
  ]);
  if (events.error) {
    throw events.error;
  }
  if (revisions.error) {
    throw revisions.error;
  }
  return [...((events.data ?? []) as Stamp[]), ...((revisions.data ?? []) as Stamp[])];
}

const capMessage = (resetsAt: string) =>
  `This free team used its ${FREE_AGENT_LAYERS_PER_WEEK.toLocaleString('en-US')} agent edits for the week. Room frees up from ${resetsAt}. Subscribe (€${PLAN.price} per editor per month, ${BILLING_PATH}) for unlimited agent edits; your own edits are never capped.`;

export async function agentEditCap(db: Db, orgId: string, now = new Date()): Promise<AgentEditCap | null> {
  try {
    return await capOf(db, orgId, now);
  } catch (e) {
    console.error('[agent-edits] weekly count failed, the edit goes on', orgId, e);
    return null;
  }
}

async function capOf(db: Db, orgId: string, now: Date): Promise<AgentEditCap | null> {
  if ((await billingTierOf(db, orgId)) === BillingTier.Paid) {
    return null;
  }

  const stamps = await agentStamps(db, orgId, new Date(now.getTime() - WEEK_MS).toISOString());
  if (stamps.length < FREE_AGENT_LAYERS_PER_WEEK) {
    return null;
  }

  const oldest = Math.min(...stamps.map((s) => new Date(s.created_at).getTime()));
  const resetsAt = new Date(oldest + WEEK_MS).toISOString();
  return {
    error: AGENT_EDIT_CAP,
    used: Math.min(stamps.length, FREE_AGENT_LAYERS_PER_WEEK),
    limit: FREE_AGENT_LAYERS_PER_WEEK,
    resets_at: resetsAt,
    upgrade_path: BILLING_PATH,
    message: capMessage(resetsAt)
  };
}

export async function agentEditRefusal(db: Db, orgId: string): Promise<Response | null> {
  const cap = await agentEditCap(db, orgId);
  return cap ? json({ ...cap, code: cap.error }, { status: HTTP_PAYMENT_REQUIRED }) : null;
}

export const AGENT_EDIT_CAP_STATUS = HTTP_PAYMENT_REQUIRED;

export type AgentEditUsage = { used: number; limit: number };

export async function agentEditUsage(db: Db, orgId: string, now = new Date()): Promise<AgentEditUsage | null> {
  try {
    if ((await billingTierOf(db, orgId)) === BillingTier.Paid) {
      return null;
    }
    const stamps = await agentStamps(db, orgId, new Date(now.getTime() - WEEK_MS).toISOString());
    return { used: Math.min(stamps.length, FREE_AGENT_LAYERS_PER_WEEK), limit: FREE_AGENT_LAYERS_PER_WEEK };
  } catch {
    return null;
  }
}
