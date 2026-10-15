import type { TaskProvider, TaskState } from './canvas/task-provider';
import { mimeOfOutputUrl, numericKeysOf, withNumbers } from './generation/wire-values';

export const DEFAULT_KIE_BASE_URL = 'https://api.kie.ai/api/v1';

export const KIE_CREDIT_USD = 0.005;

const KIE_OK = 200;

const RUNNING_STATES = new Set(['waiting', 'queuing', 'generating']);

type KieConfig = { apiKey: string; baseUrl?: string; fetchFn?: typeof fetch };

type KieReply<T> = { code?: number; msg?: string; data?: T | null };

type KieRecord = {
  state?: string;
  resultJson?: string | null;
  failMsg?: string | null;
  failCode?: string | null;
  creditsConsumed?: number | null;
};

function resultUrlsOf(resultJson: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(resultJson ?? '{}') as { resultUrls?: unknown };
    return Array.isArray(parsed.resultUrls) ? parsed.resultUrls.map(String) : [];
  } catch {
    return [];
  }
}

function stateOf(record: KieRecord): TaskState {
  if (RUNNING_STATES.has(record.state ?? '')) {
    return { state: 'pending' };
  }
  if (record.state !== 'success') {
    return { state: 'failed', error: `kie_task_failed: ${record.failMsg || record.failCode || record.state || 'unknown'}` };
  }
  const credits = Number(record.creditsConsumed);
  return {
    state: 'done',
    outputs: resultUrlsOf(record.resultJson).map((url) => ({ url, contentType: mimeOfOutputUrl(url) })),
    costUsd: Number.isFinite(credits) && credits > 0 ? credits * KIE_CREDIT_USD : null
  };
}

export function kie(config: KieConfig): TaskProvider {
  const baseUrl = (config.baseUrl ?? DEFAULT_KIE_BASE_URL).replace(/\/$/, '');
  const doFetch = config.fetchFn ?? fetch;
  const headers = { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };

  async function call<T>(path: string, init: RequestInit): Promise<T | null | undefined> {
    const res = await doFetch(`${baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      throw new Error(`kie_failed: HTTP ${res.status} on ${path.split('?')[0]}`);
    }
    const reply = (await res.json()) as KieReply<T>;
    if (reply.code !== KIE_OK) {
      throw new Error(`kie_failed: ${reply.code} ${reply.msg ?? ''}`.trim());
    }
    return reply.data;
  }

  return {
    async run(model, inputs) {
      const body = { model: String(model.model), input: withNumbers(inputs, numericKeysOf(model)) };
      const data = await call<{ taskId?: string }>('/jobs/createTask', { method: 'POST', body: JSON.stringify(body) });
      if (!data?.taskId) {
        throw new Error('kie_failed: no task id');
      }
      return { taskId: data.taskId };
    },

    async task(taskId) {
      const record = await call<KieRecord>(`/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { method: 'GET' });
      if (!record) {
        throw new Error('kie_poll_empty: recordInfo answered without data');
      }
      return stateOf(record);
    }
  };
}
