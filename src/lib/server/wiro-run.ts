import type { AiCallLog } from './ai-log';
import type { TaskProvider, TaskState } from './canvas/task-provider';
import type { AudioFile } from './canvas/audio-provider';
import type { WiroWireSpec } from './wiro-catalogue';
import { TaskProviderName } from './generation/task-providers';

export const WIRO_TEXT_LABEL = 'canvas.text';
export const WIRO_AUDIO_LABEL = 'canvas.audio';

const SYSTEM_FIELD = 'systemInstructions';
const POLL_MS = 1_500;
const TIMEOUT_MS = 240_000;

type Done = Extract<TaskState, { state: 'done' }>;

export type WiroScope = { orgId: string; projectId: string; userId: string; actorKind?: 'user' | 'agent'; actorId?: string; agentKey?: string | null };

export type WiroRunDeps = {
  provider: TaskProvider;
  log: (entry: AiCallLog) => void;
  download?: (url: string) => Promise<AudioFile>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollMs?: number;
  timeoutMs?: number;
};

type WiroRequest = { model: string; spec: Pick<WiroWireSpec, 'owner' | 'project' | 'fields' | 'fixed'>; prompt: string; scope: WiroScope };

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function downloadAudio(url: string): Promise<AudioFile> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`media_download_failed: HTTP ${res.status}`);
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'audio/mpeg' };
}

async function finished(deps: WiroRunDeps, taskId: string): Promise<Done> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? pause;
  const deadline = now() + (deps.timeoutMs ?? TIMEOUT_MS);
  while (now() < deadline) {
    const state = await deps.provider.task(taskId);
    if (state.state === 'done') {
      return state;
    }
    if (state.state === 'failed') {
      throw new Error(state.error);
    }
    await sleep(deps.pollMs ?? POLL_MS);
  }
  throw new Error(`wiro_timeout: task ${taskId}`);
}

async function billed<T>(deps: WiroRunDeps, req: WiroRequest, label: string, inputs: Record<string, unknown>, land: (done: Done) => Promise<T>): Promise<T & { costUsd: number }> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const base = {
    label,
    provider: TaskProviderName.Wiro,
    model: req.model,
    orgId: req.scope.orgId,
    projectId: req.scope.projectId,
    userId: req.scope.userId,
    actorKind: req.scope.actorKind ?? 'user',
    actorId: req.scope.actorId ?? req.scope.userId,
    agentKey: req.scope.agentKey ?? null
  } as const;

  try {
    const { taskId } = await deps.provider.run({ owner: req.spec.owner, project: req.spec.project }, inputs);
    const done = await finished(deps, taskId);
    const costUsd = done.costUsd ?? 0;
    const out = await land(done);
    deps.log({ ...base, ms: now() - startedAt, ok: true, flatCostUsd: costUsd });
    return { ...out, costUsd };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'wiro_failed';
    deps.log({ ...base, ms: now() - startedAt, ok: false, error: message });
    throw error;
  }
}

export async function runWiroText(deps: WiroRunDeps, req: WiroRequest & { system?: string }): Promise<{ text: string; costUsd: number }> {
  const inputs = { [req.spec.fields.prompt ?? 'prompt']: req.prompt, ...(req.system ? { [SYSTEM_FIELD]: req.system } : {}) };
  return billed(deps, req, WIRO_TEXT_LABEL, inputs, async (done) => ({ text: done.text ?? '' }));
}

export async function runWiroAudio(deps: WiroRunDeps, req: WiroRequest & { duration?: number }): Promise<{ file: AudioFile; costUsd: number }> {
  const durationField = req.spec.fields.duration;
  const inputs = {
    ...req.spec.fixed,
    ...(durationField && typeof req.duration === 'number' ? { [durationField]: String(req.duration) } : {}),
    [req.spec.fields.prompt ?? 'prompt']: req.prompt
  };
  return billed(deps, req, WIRO_AUDIO_LABEL, inputs, async (done) => {
    const output = done.outputs[0];
    if (!output) {
      throw new Error('wiro_no_audio');
    }
    return { file: await (deps.download ?? downloadAudio)(output.url) };
  });
}

export async function wiroNodeDeps(): Promise<WiroRunDeps | null> {
  const [{ configuredWiro }, { logAiCall }] = await Promise.all([import('./task-providers-config'), import('./ai-log')]);
  const provider = configuredWiro();
  return provider ? { provider, log: logAiCall } : null;
}
