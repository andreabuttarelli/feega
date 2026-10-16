import type { TaskOutput, TaskProvider, TaskState } from './canvas/task-provider';
import { mimeOfOutputUrl, numericKeysOf, withNumbers } from './generation/wire-values';

export const DEFAULT_HIGGSFIELD_BASE_URL = 'https://api.higgsfield.ai';

const CANCEL_ACCEPTED = 202;

const RUNNING_STATUSES = new Set(['queued', 'in_progress']);

export type HiggsfieldConfig = { keyId: string; keySecret: string; baseUrl?: string; fetchFn?: typeof fetch };

const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined;

export function higgsfieldConfig(env: Readonly<Record<string, string | undefined>>): HiggsfieldConfig | null {
  const keyId = trimmed(env.HIGGSFIELD_API_KEY_ID);
  const keySecret = trimmed(env.HIGGSFIELD_API_KEY_SECRET);
  return keyId && keySecret ? { keyId, keySecret, baseUrl: trimmed(env.HIGGSFIELD_BASE_URL) } : null;
}

type MediaOutput = { url?: string };

type RequestStatus = {
  status?: string;
  request_id?: string;
  error?: string | null;
  images?: MediaOutput[];
  video?: MediaOutput;
  audio?: MediaOutput;
};

const TERMINAL_FAILURES: Readonly<Record<string, (status: RequestStatus) => string>> = {
  failed: (status) => `higgsfield_failed: ${status.error || 'generation failed'}`,
  nsfw: () => 'higgsfield_nsfw: rejected by moderation',
  canceled: () => 'higgsfield_canceled'
};

function outputsOf(status: RequestStatus): TaskOutput[] {
  return [...(status.images ?? []), status.video, status.audio]
    .map((output) => output?.url)
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url, contentType: mimeOfOutputUrl(url) }));
}

function stateOf(status: RequestStatus): TaskState {
  if (RUNNING_STATUSES.has(status.status ?? '')) {
    return { state: 'pending' };
  }
  const failure = TERMINAL_FAILURES[status.status ?? ''];
  if (failure) {
    return { state: 'failed', error: failure(status) };
  }
  return { state: 'done', outputs: outputsOf(status), costUsd: null };
}

function client(config: HiggsfieldConfig) {
  const baseUrl = (config.baseUrl ?? DEFAULT_HIGGSFIELD_BASE_URL).replace(/\/$/, '');
  const doFetch = config.fetchFn ?? fetch;
  const auth = { Authorization: `Key ${config.keyId}:${config.keySecret}`, 'Content-Type': 'application/json' };

  return async function call(path: string, init: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
    return doFetch(`${baseUrl}/${path.replace(/^\//, '')}`, { ...init, headers: { ...auth, ...init.headers } });
  };
}

async function failure(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
  const detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? '');
  return new Error(`higgsfield_failed: HTTP ${res.status} ${detail}`.trim());
}

async function ok<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw await failure(res);
  }
  return (await res.json()) as T;
}

export function higgsfield(config: HiggsfieldConfig): TaskProvider & Required<Pick<TaskProvider, 'cancel'>> {
  const call = client(config);

  return {
    async run(model, inputs, idempotencyKey) {
      const body = JSON.stringify(withNumbers(inputs, numericKeysOf(model)));
      const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
      const status = await ok<RequestStatus>(await call(String(model.path), { method: 'POST', body, headers }));
      if (!status.request_id) {
        throw new Error('higgsfield_failed: no request id');
      }
      return { taskId: status.request_id };
    },

    async task(taskId) {
      return stateOf(await ok<RequestStatus>(await call(`requests/${encodeURIComponent(taskId)}/status`, { method: 'GET' })));
    },

    async cancel(taskId) {
      const res = await call(`requests/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' });
      return res.status === CANCEL_ACCEPTED;
    }
  };
}

export async function higgsfieldEstimate(config: HiggsfieldConfig, path: string, inputs: Record<string, unknown>): Promise<number | null> {
  const reply = await ok<{ usd?: string | number }>(await client(config)(`estimate/${path}`, { method: 'POST', body: JSON.stringify(inputs) }));
  const usd = Number(reply.usd);
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}
