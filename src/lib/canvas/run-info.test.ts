import { describe, expect, it } from 'vitest';
import { copyableParams, runInfoOf, viewableRuns, type ViewerRun } from './run-info';

const run = (over: Partial<ViewerRun> = {}): ViewerRun => ({
  id: 'r1',
  outputAssetId: 'a1',
  prompt: 'a red shoe',
  model: 'openai/gpt-image',
  params: { seed: 42, aspectRatio: '1:1' },
  costUsd: 0.04,
  startedAt: '2026-10-24T10:00:00Z',
  status: 'done',
  ...over
});

describe('runInfoOf', () => {
  it('shows seed, model, cost and prompt', () => {
    expect(runInfoOf(run())).toEqual({ prompt: 'a red shoe', model: 'openai/gpt-image', seed: '42', cost: '$0.04', startedAt: '2026-10-24T10:00:00Z' });
  });

  it('says nothing about what a run does not know', () => {
    const info = runInfoOf(run({ params: {}, costUsd: null, model: null }));

    expect(info).toMatchObject({ seed: null, cost: null, model: null });
  });

  it('keeps a sub-cent cost readable', () => {
    expect(runInfoOf(run({ costUsd: 0.0004 })).cost).toBe('$0.0004');
  });
});

describe('viewableRuns', () => {
  it('keeps finished runs with an output, once per asset, oldest first', () => {
    const rows = [run({ id: 'b', outputAssetId: 'a2', startedAt: '2026-10-24T11:00:00Z' }), run({ id: 'x', outputAssetId: null }), run({ id: 'dup', outputAssetId: 'a1', startedAt: '2026-10-24T12:00:00Z' }), run({ id: 'a' })];

    expect(viewableRuns(rows).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('copyableParams', () => {
  it('is JSON with prompt, model and params', () => {
    expect(JSON.parse(copyableParams(run()))).toEqual({ prompt: 'a red shoe', model: 'openai/gpt-image', params: { seed: 42, aspectRatio: '1:1' } });
  });
});
