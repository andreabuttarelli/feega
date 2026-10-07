import { describe, expect, it, vi } from 'vitest';
import { DeepPhase } from '$lib/motion/deep';
import type { NodeRun } from '$lib/server/repos/node-runs';
import type { DeepParams } from '$lib/server/repos/deep-runs';
import { MAX_RESUMES, deepView, resumeDeepRuns } from './job';
import { freshState } from './loop';

const params = (overrides: Partial<DeepParams> = {}): DeepParams => ({
  kind: 'motion-deep',
  message: 'make a launch video for dub.co',
  model: 'anthropic/claude-opus-5.5',
  userId: 'u1',
  threadId: 't1',
  quote: { usd: 5, credits: 2000, capUsd: 7.5, capCredits: 3000 },
  state: { ...freshState(), phase: DeepPhase.Build, iteration: 2, verdict: { pass: false, score: 6, fixes: ['a'] } },
  spentUsd: 2.5,
  stop: false,
  assets: '',
  resumes: 0,
  end: null,
  ...overrides
});

const run = (p: DeepParams, overrides: Partial<NodeRun> = {}): NodeRun => ({
  id: 'r1',
  orgId: 'o1',
  nodeId: 'n1',
  prompt: p.message,
  model: p.model,
  params: p,
  status: 'running',
  error: null,
  outputAssetId: null,
  externalJobId: 'motion-deep:x',
  costUsd: null,
  attempts: 0,
  actorId: 'u1',
  startedAt: '2026-10-07T10:00:00Z',
  finishedAt: null,
  ...overrides
});

describe('a Deep job seen from the chat', () => {
  it('shows the phase, the round and the credits spent so far', () => {
    const view = deepView(run(params()));

    expect(view).toMatchObject({ runId: 'r1', status: 'running', phase: DeepPhase.Build, iteration: 2, quoteCredits: 2000, capCredits: 3000, stopping: false });
    expect(view.spentCredits).toBe(1000);
  });

  it('says it is stopping once the user pressed Stop', () => {
    expect(deepView(run(params({ stop: true }))).stopping).toBe(true);
  });
});

describe('resuming Deep jobs whose function died', () => {
  it('resumes every stale job it manages to claim, once', async () => {
    const trigger = vi.fn(async () => {});
    const claim = vi.fn(async (id: string) => id !== 'taken');

    const resumed = await resumeDeepRuns({
      stale: async () => [
        { id: 'a', orgId: 'o', heartbeatAt: null },
        { id: 'taken', orgId: 'o', heartbeatAt: '2026-10-07T10:00:00Z' }
      ],
      claim: (row) => claim(row.id),
      resumes: async () => 1,
      fail: vi.fn(),
      trigger
    });

    expect(resumed).toBe(1);
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith('a');
  });

  it('gives up on a job that keeps dying instead of resuming it forever', async () => {
    const trigger = vi.fn(async () => {});
    const fail = vi.fn(async () => {});

    await resumeDeepRuns({ stale: async () => [{ id: 'a', orgId: 'o', heartbeatAt: null }], claim: async () => true, resumes: async () => MAX_RESUMES, fail, trigger });

    expect(trigger).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith('a');
  });
});
