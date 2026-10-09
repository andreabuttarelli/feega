import type { Db } from '$lib/server/db/client';
import type { Json } from '$lib/database.types';
import { toolsForMirror } from '$lib/chat-stream-events';
import { actorCols, type Actor } from './actor';
import { AGENT_MAX_DURATION_S } from '$lib/server/brand-agent/limits';

const MS_PER_S = 1000;

/**
 * I THREAD DELLA CHAT DI PROGETTO, SULLO SCHEMA NUOVO.
 *
 * Un thread per progetto e per utente, discriminato da `surface`: ricarichi e sei nella stessa
 * conversazione, due persone dello stesso progetto non si leggono i messaggi a vicenda.
 * Ogni query porta `org_id` — è la regola di `tenancy.test.ts`, e qui vale anche quando il
 * `project_id` basterebbe a identificare la riga.
 */

export const SIDEBAR_SURFACE = 'sidebar';

/** La cronologia viaggia nel prompt a ogni messaggio: senza tetto il conto cresce da solo. */
export const HISTORY_LIMIT = 40;

export type SavedTool = {
  toolCallId: string;
  toolName: string;
  status: 'done' | 'error';
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export type Turn = { role: 'user' | 'assistant'; content: string; tools?: SavedTool[]; streaming?: true };

const STREAMING = 'streaming';

export type PromptTurn = { role: Turn['role']; content: string };

export async function openThread(
  db: Db,
  input: { orgId: string; projectId: string; userId: string; brandId?: string | null }
): Promise<string> {
  const { data: existing } = await db
    .from('chat_threads')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('project_id', input.projectId)
    .eq('created_by', input.userId)
    .eq('surface', SIDEBAR_SURFACE)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return existing.id as string;
  }

  const { data, error } = await db
    .from('chat_threads')
    .insert({
      org_id: input.orgId,
      project_id: input.projectId,
      brand_id: input.brandId ?? null,
      created_by: input.userId,
      surface: SIDEBAR_SURFACE,
      title: 'Project'
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data.id as string;
}

export const MOTION_SURFACE = 'motion';

export async function openNodeThread(
  db: Db,
  input: { orgId: string; projectId: string; nodeId: string; userId: string; brandId?: string | null }
): Promise<string> {
  const { data: existing } = await db
    .from('chat_threads')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('node_id', input.nodeId)
    .eq('created_by', input.userId)
    .eq('surface', MOTION_SURFACE)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return existing.id as string;
  }

  const { data, error } = await db
    .from('chat_threads')
    .insert({
      org_id: input.orgId,
      project_id: input.projectId,
      node_id: input.nodeId,
      brand_id: input.brandId ?? null,
      created_by: input.userId,
      surface: MOTION_SURFACE,
      title: 'Motion'
    } as never)
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data.id as string;
}

/** Gli ULTIMI messaggi, rimessi in ordine cronologico: il modello non legge la chat al contrario. */
export async function loadTurns(
  db: Db,
  input: { orgId: string; threadId: string }
): Promise<Turn[]> {
  const { data } = await db
    .from('chat_messages')
    .select('*')
    .eq('org_id', input.orgId)
    .eq('thread_id', input.threadId)
    .order('seq', { ascending: false })
    .limit(HISTORY_LIMIT);

  const rows = (data ?? []) as Array<{ role?: string; content?: string | null; tool_calls?: SavedTool[] | null; status?: string }>;

  return rows
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .filter((row) => row.content?.trim() || row.tool_calls?.length)
    .map((row) => ({
      role: row.role as Turn['role'],
      content: row.content ?? '',
      ...(row.tool_calls?.length ? { tools: row.tool_calls } : {}),
      ...(row.status === STREAMING ? { streaming: true as const } : {})
    }))
    .reverse();
}

export function promptHistory(turns: Turn[]): PromptTurn[] {
  return turns.filter((t) => t.content.trim()).map(({ role, content }) => ({ role, content }));
}

/**
 * `seq` è obbligatorio e unico per thread: due messaggi nello stesso millisecondo esistono, e
 * l'ordine di una conversazione non può dipendere dall'orologio. Si prende il massimo e si aggiunge.
 */
export async function saveTurn(
  db: Db,
  input: {
    orgId: string;
    threadId: string;
    role: Turn['role'];
    content: string;
    tools?: SavedTool[];
    actor: Actor;
  }
): Promise<void> {
  const { data: last } = await db
    .from('chat_messages')
    .select('seq, role, content')
    .eq('org_id', input.orgId)
    .eq('thread_id', input.threadId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previous = last as { seq?: number; role?: string; content?: string | null } | null;
  if (input.role === 'user' && previous?.role === 'user' && previous.content === input.content) {
    return;
  }

  const seq = Number(previous?.seq ?? 0) + 1;

  const { error } = await db.from('chat_messages').insert({
    org_id: input.orgId,
    thread_id: input.threadId,
    role: input.role,
    content: input.content,
    tool_calls: input.tools?.length ? (toolsForMirror(input.tools) as Json) : null,
    seq,
    ...actorCols(input.actor)
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function turnRunning(db: Db, input: { orgId: string; threadId: string }, now = Date.now()): Promise<boolean> {
  const { data } = await db
    .from('chat_messages')
    .select('*')
    .eq('org_id', input.orgId)
    .eq('thread_id', input.threadId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  const last = data as { id?: string; role?: string; status?: string; created_at?: string } | null;
  const streaming = last?.status === STREAMING;
  const awaited = last?.role === 'user' || streaming;
  if (!awaited || !last?.created_at) {
    return false;
  }

  const alive = now - Date.parse(last.created_at) < AGENT_MAX_DURATION_S * MS_PER_S;
  if (!alive && streaming && last.id) {
    await closeCutReply(db, { orgId: input.orgId, id: last.id });
  }
  return alive;
}

async function closeCutReply(db: Db, input: { orgId: string; id: string }) {
  await db.from('chat_messages').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('org_id', input.orgId).eq('id', input.id).eq('status', STREAMING);
}
