import { createHmac } from 'node:crypto';
import type { PurgeOutcome } from './canvas/provider-purge';
import type { WiroGateway, WiroTask } from './canvas/wiro-gateway';

export const DEFAULT_WIRO_BASE_URL = 'https://api.wiro.ai/v1';

const FINISHED = 'task_postprocess_end';
const FAILED_STATUSES = new Set(['task_cancel', 'task_error', 'task_kill']);
const SUCCESS_EXIT = '0';
const PURGEABLE_STATUSES = new Set([FINISHED, 'task_cancel']);

type WiroConfig = {
  apiKey: string;
  apiSecret?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  nonce?: () => string;
};

type WiroReply = { result?: boolean; errors?: Array<{ message?: string } | string> };

type TaskRow = {
  status?: string;
  socketaccesstoken?: string;
  pexit?: string;
  totalcost?: string;
  debugoutput?: string;
  outputs?: Array<{ url?: string; contenttype?: string }>;
};

function authHeaders(config: WiroConfig): Record<string, string> {
  if (!config.apiSecret) {
    return { 'x-api-key': config.apiKey };
  }
  const nonce = (config.nonce ?? (() => String(Math.floor(Date.now() / 1000))))();
  const signature = createHmac('sha256', config.apiKey).update(`${config.apiSecret}${nonce}`).digest('hex');
  return { 'x-api-key': config.apiKey, 'x-nonce': nonce, 'x-signature': signature };
}

function errorsOf(reply: WiroReply): string {
  return (reply.errors ?? []).map((e) => (typeof e === 'string' ? e : e.message ?? '')).filter(Boolean).join('; ') || 'unknown error';
}

function taskOf(row: TaskRow | undefined): WiroTask {
  if (!row) {
    return { state: 'failed', error: 'wiro_task_missing' };
  }
  if (FAILED_STATUSES.has(row.status ?? '')) {
    return { state: 'failed', error: `wiro_task_failed: ${row.status}` };
  }
  if (row.status !== FINISHED) {
    return { state: 'pending' };
  }
  if (row.pexit !== SUCCESS_EXIT) {
    return { state: 'failed', error: `wiro_task_failed: ${row.debugoutput || `exit ${row.pexit}`}` };
  }
  return {
    state: 'done',
    costUsd: Number(row.totalcost ?? 0) || 0,
    outputs: (row.outputs ?? [])
      .filter((o): o is { url: string; contenttype?: string } => Boolean(o.url))
      .map((o) => ({ url: o.url, contentType: o.contenttype ?? 'application/octet-stream' }))
  };
}

export function wiro(config: WiroConfig): WiroGateway {
  const baseUrl = (config.baseUrl ?? DEFAULT_WIRO_BASE_URL).replace(/\/$/, '');
  const doFetch = config.fetchFn ?? fetch;

  async function post<T extends WiroReply>(path: string, body: unknown): Promise<T> {
    const res = await doFetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { ...authHeaders(config), 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw new Error(`wiro_failed: HTTP ${res.status} on ${path}`);
    }
    const reply = (await res.json()) as T;
    if (reply.result === false) {
      throw new Error(`wiro_failed: ${errorsOf(reply)}`);
    }
    return reply;
  }

  return {
    async run(model, inputs) {
      const reply = await post<WiroReply & { taskid?: string }>(`/Run/${model.owner}/${model.project}`, inputs);
      if (!reply.taskid) {
        throw new Error('wiro_failed: no task id');
      }
      return { taskId: String(reply.taskid) };
    },

    async task(taskId) {
      const reply = await post<WiroReply & { tasklist?: TaskRow[] }>('/Task/Detail', { taskid: taskId });
      return taskOf(reply.tasklist?.[0]);
    },

    async purge(taskId): Promise<PurgeOutcome> {
      const reply = await post<WiroReply & { tasklist?: TaskRow[] }>('/Task/Detail', { taskid: taskId });
      const row = reply.tasklist?.[0];
      if (!row?.socketaccesstoken || !PURGEABLE_STATUSES.has(row.status ?? '')) {
        return 'not_ready';
      }
      await post('/Task/InputOutputDelete', { tasktoken: row.socketaccesstoken });
      return 'purged';
    }
  };
}
