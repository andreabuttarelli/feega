import type { Db } from '$lib/server/db/client';
import type { Json } from '$lib/database.types';
import { toolsForMirror } from '$lib/chat-stream-events';
import { actorCols, type Actor } from './actor';
import type { SavedTool } from './chat';

export enum ReplyStatus {
  Streaming = 'streaming',
  Done = 'done',
  Failed = 'failed'
}

export type ReplyBody = { content: string; tools: SavedTool[] };

export type Reply = {
  progress(body: ReplyBody): Promise<void>;
  finish(body: ReplyBody, status: ReplyStatus.Done | ReplyStatus.Failed): Promise<void>;
  stopped(): Promise<boolean>;
};

type ReplyScope = { orgId: string; threadId: string; actor: Actor };

enum StatusColumn {
  Unknown = 'unknown',
  Missing = 'missing'
}

const MISSING_COLUMN_CODES = new Set(['PGRST204', '42703']);

let statusColumn = StatusColumn.Unknown;

export function forgetReplySchema() {
  statusColumn = StatusColumn.Unknown;
}

async function nextSeq(db: Db, scope: ReplyScope): Promise<number> {
  const { data } = await db
    .from('chat_messages')
    .select('seq')
    .eq('org_id', scope.orgId)
    .eq('thread_id', scope.threadId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number((data as { seq?: number } | null)?.seq ?? 0) + 1;
}

const bodyCols = (body: ReplyBody) => ({
  content: body.content,
  tool_calls: body.tools.length ? (toolsForMirror(body.tools) as Json) : null
});

const rowOf = async (db: Db, scope: ReplyScope) => ({
  thread_id: scope.threadId,
  role: 'assistant',
  seq: await nextSeq(db, scope),
  ...actorCols(scope.actor)
});

type Ending = Omit<Reply, 'stopped'>;

function endingOnce(write: (body: ReplyBody, status: ReplyStatus) => Promise<void>, progress: (body: ReplyBody) => Promise<void>): Ending {
  let ended = false;
  let queue = Promise.resolve();
  const enqueue = (fn: () => Promise<void>) => (queue = queue.then(fn).catch((e) => console.error('[chat-reply] write failed', e)));

  return {
    progress: (body) => (ended ? queue : enqueue(() => progress(body))),
    finish: (body, status) => {
      if (ended) {
        return queue;
      }
      ended = true;
      return enqueue(() => write(body, status));
    }
  };
}

function savedAtEnd(db: Db, scope: ReplyScope): Reply {
  const ending = endingOnce(
    async (body, status) => {
      if (status === ReplyStatus.Failed && !body.content && !body.tools.length) {
        return;
      }
      const { error } = await db.from('chat_messages').insert({ org_id: scope.orgId, ...(await rowOf(db, scope)), ...bodyCols(body) });
      if (error) {
        throw new Error(error.message);
      }
    },
    async () => {}
  );
  return { ...ending, stopped: async () => false };
}

function writtenLive(db: Db, scope: ReplyScope, id: string): Reply {
  const update = async (body: ReplyBody, status: ReplyStatus) => {
    const { error } = await db
      .from('chat_messages')
      .update({ ...bodyCols(body), status, updated_at: new Date().toISOString() })
      .eq('org_id', scope.orgId)
      .eq('id', id)
      .eq('status', ReplyStatus.Streaming);
    if (error) {
      throw new Error(error.message);
    }
  };
  const stopped = async () => {
    const { data } = await db.from('chat_messages').select('status').eq('org_id', scope.orgId).eq('id', id).maybeSingle();
    const status = (data as { status?: string } | null)?.status;
    return Boolean(status) && status !== ReplyStatus.Streaming;
  };
  return { ...endingOnce(update, (body) => update(body, ReplyStatus.Streaming)), stopped };
}

export async function stopTurn(db: Db, scope: { orgId: string; threadId: string }): Promise<void> {
  const { error } = await db
    .from('chat_messages')
    .update({ status: ReplyStatus.Failed, updated_at: new Date().toISOString() })
    .eq('org_id', scope.orgId)
    .eq('thread_id', scope.threadId)
    .eq('status', ReplyStatus.Streaming);
  if (error && !MISSING_COLUMN_CODES.has(error.code ?? '')) {
    throw new Error(error.message);
  }
}

export async function openReply(db: Db, scope: ReplyScope): Promise<Reply> {
  if (statusColumn === StatusColumn.Missing) {
    return savedAtEnd(db, scope);
  }

  try {
    const { data, error } = await db
      .from('chat_messages')
      .insert({ org_id: scope.orgId, ...(await rowOf(db, scope)), content: '', status: ReplyStatus.Streaming })
      .select('id')
      .single();
    if (error && MISSING_COLUMN_CODES.has(error.code ?? '')) {
      statusColumn = StatusColumn.Missing;
    }
    if (error || !data) {
      return savedAtEnd(db, scope);
    }
    return writtenLive(db, scope, (data as { id: string }).id);
  } catch (e) {
    console.error('[chat-reply] live reply not opened, saving at the end', e);
    return savedAtEnd(db, scope);
  }
}
