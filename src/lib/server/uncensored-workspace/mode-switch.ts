import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { ProjectMode } from '$lib/project-mode';
import { UncensoredLock } from '$lib/uncensored-lock';
import { uncensoredLockFor } from './workspace-server';

export const OUTPUTS_PRESENT = 'uncensored_outputs_present';
export const NOT_SHAREABLE = 'uncensored_not_shareable';

export const SWITCH_REFUSAL_TEXT: Readonly<Record<string, string>> = {
  [OUTPUTS_PRESENT]: 'This project already holds work made in uncensored mode, so it stays uncensored. Start a new project for standard work.',
  [NOT_SHAREABLE]: 'Revoke the public share links in this project before turning uncensored mode on.'
};

export type SwitchFacts = { lock: UncensoredLock; hasOutputs: boolean; hasShares: boolean };

const DIRECTION: Readonly<Record<ProjectMode, (facts: SwitchFacts) => string | null>> = {
  [ProjectMode.Uncensored]: (f) => (f.lock !== UncensoredLock.Open ? f.lock : f.hasShares ? NOT_SHAREABLE : null),
  [ProjectMode.Standard]: (f) => (f.hasOutputs ? OUTPUTS_PRESENT : null)
};

export function modeSwitchRefusal(to: ProjectMode, facts: SwitchFacts): string | null {
  return DIRECTION[to](facts);
}

async function exists(query: PromiseLike<{ data: unknown[] | null }>): Promise<boolean> {
  return ((await query).data ?? []).length > 0;
}

async function factsOf(db: Db, input: { orgId: string; userId: string; projectId: string }): Promise<SwitchFacts> {
  const raw = db as unknown as SupabaseClient;
  const [lock, assets, calls, canvases, nodes] = await Promise.all([
    uncensoredLockFor(db, input),
    exists(raw.from('assets').select('id').eq('project_id', input.projectId).eq('uncensored_project', true).limit(1)),
    exists(raw.from('ai_calls').select('id').eq('project_id', input.projectId).eq('billing_scope', ProjectMode.Uncensored).limit(1)),
    exists(raw.from('canvases').select('id').eq('project_id', input.projectId).not('share_token', 'is', null).limit(1)),
    exists(raw.from('nodes').select('id').eq('project_id', input.projectId).not('public_token_hash', 'is', null).limit(1))
  ]);
  return { lock, hasOutputs: assets || calls, hasShares: canvases || nodes };
}

export type SwitchOutcome = { ok: true } | { ok: false; error: string };

export async function switchProjectMode(db: Db, input: { orgId: string; userId: string; projectId: string; to: ProjectMode }): Promise<SwitchOutcome> {
  const refusal = modeSwitchRefusal(input.to, await factsOf(db, input));
  if (refusal) {
    return { ok: false, error: refusal };
  }

  const { error } = await (db as unknown as SupabaseClient)
    .from('projects')
    .update({ mode: input.to, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .eq('org_id', input.orgId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
