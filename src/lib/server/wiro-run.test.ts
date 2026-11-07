import { describe, expect, it, vi } from 'vitest';
import type { AiCallLog } from './ai-log';
import type { TaskProvider, TaskState } from './canvas/task-provider';
import { runWiroAudio, runWiroText, type WiroRunDeps } from './wiro-run';

const SCOPE = { orgId: 'org', projectId: 'proj', userId: 'user' };
const TEXT_SPEC = { owner: 'openai', project: 'gpt-5-nano', fields: { prompt: 'prompt', images: [] } };
const TTS_SPEC = { owner: 'elevenlabs', project: 'eleven-v4-turbo', fields: { prompt: 'prompt', images: [] }, fixed: { voice: 'alice' } };
const MUSIC_SPEC = { owner: 'elevenlabs', project: 'text-to-music-v2', fields: { prompt: 'prompt', duration: 'duration', images: [] }, fixed: { duration: '30' } };

function depsWith(states: TaskState[], extra: Partial<WiroRunDeps> = {}) {
  const logs: AiCallLog[] = [];
  const run = vi.fn(async () => ({ taskId: 't1' }));
  const queue = [...states];
  const provider: TaskProvider = { run, task: async () => queue.shift() ?? { state: 'pending' } };
  const deps: WiroRunDeps = { provider, log: (e) => logs.push(e), sleep: async () => {}, now: () => 0, ...extra };
  return { deps, logs, run };
}

describe('a Wiro LLM writes a text node', () => {
  it('sends prompt and system, waits for the task and returns its text at the billed cost', async () => {
    const { deps, logs, run } = depsWith([{ state: 'pending' }, { state: 'done', outputs: [], costUsd: 0.0012, text: 'Hello.' }]);

    const out = await runWiroText(deps, { model: 'wiro/openai/gpt-5-nano', spec: TEXT_SPEC, prompt: 'Say hi', system: 'Be brief', scope: SCOPE });

    expect(out).toEqual({ text: 'Hello.', costUsd: 0.0012 });
    expect(run).toHaveBeenCalledWith({ owner: 'openai', project: 'gpt-5-nano' }, { prompt: 'Say hi', systemInstructions: 'Be brief' });
    expect(logs).toEqual([expect.objectContaining({ provider: 'wiro', model: 'wiro/openai/gpt-5-nano', ok: true, flatCostUsd: 0.0012, orgId: 'org' })]);
  });

  it('logs and throws a failed task', async () => {
    const { deps, logs } = depsWith([{ state: 'failed', error: 'wiro_task_failed: boom' }]);

    await expect(runWiroText(deps, { model: 'wiro/openai/gpt-5-nano', spec: TEXT_SPEC, prompt: 'x', scope: SCOPE })).rejects.toThrow('boom');
    expect(logs).toEqual([expect.objectContaining({ ok: false, error: 'wiro_task_failed: boom' })]);
  });

  it('gives up on a task that never finishes', async () => {
    let clock = 0;
    const { deps } = depsWith([], { now: () => (clock += 60_000), timeoutMs: 120_000 });

    await expect(runWiroText(deps, { model: 'wiro/openai/gpt-5-nano', spec: TEXT_SPEC, prompt: 'x', scope: SCOPE })).rejects.toThrow('wiro_timeout');
  });
});

describe('a Wiro speech or music model voices an audio node', () => {
  it('sends the fixed fields and returns the audio file it made', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const download = vi.fn(async () => ({ bytes: audio, mime: 'audio/mpeg' }));
    const { deps, run } = depsWith([{ state: 'done', outputs: [{ url: 'https://cdn.wiro/0.mp3', contentType: 'audio/mpeg' }], costUsd: 0.0004 }], { download });

    const out = await runWiroAudio(deps, { model: 'wiro/elevenlabs/eleven-v4-turbo', spec: TTS_SPEC, prompt: 'Hi there', scope: SCOPE });

    expect(run).toHaveBeenCalledWith({ owner: 'elevenlabs', project: 'eleven-v4-turbo' }, { voice: 'alice', prompt: 'Hi there' });
    expect(download).toHaveBeenCalledWith('https://cdn.wiro/0.mp3');
    expect(out).toEqual({ file: { bytes: audio, mime: 'audio/mpeg' }, costUsd: 0.0004 });
  });

  it('passes the chosen duration over the default', async () => {
    const download = async () => ({ bytes: new Uint8Array([1]), mime: 'audio/mpeg' });
    const { deps, run } = depsWith([{ state: 'done', outputs: [{ url: 'u', contentType: 'audio/mpeg' }], costUsd: 0.025 }], { download });

    await runWiroAudio(deps, { model: 'wiro/elevenlabs/text-to-music-v2', spec: MUSIC_SPEC, prompt: 'lofi', duration: 10, scope: SCOPE });

    expect(run).toHaveBeenCalledWith(expect.anything(), { duration: '10', prompt: 'lofi' });
  });

  it('refuses a finished task without an audio file', async () => {
    const { deps } = depsWith([{ state: 'done', outputs: [], costUsd: 0 }], { download: vi.fn() });

    await expect(runWiroAudio(deps, { model: 'wiro/google/lyria-3', spec: TTS_SPEC, prompt: 'x', scope: SCOPE })).rejects.toThrow('wiro_no_audio');
  });
});
