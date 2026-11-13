import { json } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { billingTierOf, BillingTier } from '$lib/server/billing-tier';
import { FREE_AGENT_LAYERS_PER_WEEK, PLAN } from '$lib/credit-ladder';
import { BILLING_PATH } from '$lib/billing-path';
import { AGENT_DECIDED_KEYS } from '$lib/server/repos/actor';

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

type Stamp = { created_at: string; layers: number };

type Week = { used: number; oldest: number | null };

async function agentWeek(db: Db, orgId: string, since: string): Promise<Week> {
  const client = db as unknown as SupabaseClient;
  const window = (table: string, columns: string) =>
    client.from(table).select(columns).eq('org_id', orgId).eq('actor_kind', AGENT).in('agent_key', [...AGENT_DECIDED_KEYS]).gte('created_at', since).order('created_at');
  const [events, revisions] = await Promise.all([
    window('canvas_events', 'created_at').in('kind', LAYER_EVENTS).limit(FREE_AGENT_LAYERS_PER_WEEK),
    window('motion_revisions', 'created_at, layers_touched').limit(FREE_AGENT_LAYERS_PER_WEEK)
  ]);
  if (events.error) {
    throw events.error;
  }
  if (revisions.error) {
    throw revisions.error;
  }

  const stamps: Stamp[] = [
    ...((events.data ?? []) as unknown as { created_at: string }[]).map((e) => ({ created_at: e.created_at, layers: 1 })),
    ...((revisions.data ?? []) as unknown as { created_at: string; layers_touched: number | null }[]).map((r) => ({ created_at: r.created_at, layers: Math.max(1, r.layers_touched ?? 1) }))
  ];
  return {
    used: stamps.reduce((sum, s) => sum + s.layers, 0),
    oldest: stamps.length ? Math.min(...stamps.map((s) => new Date(s.created_at).getTime())) : null
  };
}

const capMessage = (left: number, cost: number, resetsAt: string) =>
  `This free team has ${left} of its ${FREE_AGENT_LAYERS_PER_WEEK.toLocaleString('en-US')} weekly agent edits left, and this request would change ${cost}. Room frees up from ${resetsAt}. Subscribe (€${PLAN.price} per editor per month, ${BILLING_PATH}) for unlimited agent edits; your own edits are never capped.`;

export async function agentEditCap(db: Db, orgId: string, now = new Date(), cost = 1): Promise<AgentEditCap | null> {
  try {
    return await capOf(db, orgId, now, cost);
  } catch (e) {
    console.error('[agent-edits] weekly count failed, the edit goes on', orgId, e);
    return null;
  }
}

async function capOf(db: Db, orgId: string, now: Date, cost: number): Promise<AgentEditCap | null> {
  if ((await billingTierOf(db, orgId)) === BillingTier.Paid) {
    return null;
  }

  const week = await agentWeek(db, orgId, new Date(now.getTime() - WEEK_MS).toISOString());
  if (week.used + cost <= FREE_AGENT_LAYERS_PER_WEEK) {
    return null;
  }

  const used = Math.min(week.used, FREE_AGENT_LAYERS_PER_WEEK);
  const resetsAt = new Date((week.oldest ?? now.getTime()) + WEEK_MS).toISOString();
  return {
    error: AGENT_EDIT_CAP,
    used,
    limit: FREE_AGENT_LAYERS_PER_WEEK,
    resets_at: resetsAt,
    upgrade_path: BILLING_PATH,
    message: capMessage(FREE_AGENT_LAYERS_PER_WEEK - used, cost, resetsAt)
  };
}

export async function agentEditRefusal(db: Db, orgId: string, cost = 1): Promise<Response | null> {
  const cap = await agentEditCap(db, orgId, new Date(), cost);
  return cap ? json({ ...cap, code: cap.error }, { status: HTTP_PAYMENT_REQUIRED }) : null;
}

export const AGENT_EDIT_CAP_STATUS = HTTP_PAYMENT_REQUIRED;

export type AgentEditUsage = { used: number; limit: number };

export async function agentEditUsage(db: Db, orgId: string, now = new Date()): Promise<AgentEditUsage | null> {
  try {
    if ((await billingTierOf(db, orgId)) === BillingTier.Paid) {
      return null;
    }
    const week = await agentWeek(db, orgId, new Date(now.getTime() - WEEK_MS).toISOString());
    return { used: Math.min(week.used, FREE_AGENT_LAYERS_PER_WEEK), limit: FREE_AGENT_LAYERS_PER_WEEK };
  } catch {
    return null;
  }
}
