import { describe, expect, it } from 'vitest';
import { diffRuns, type DiffableRun } from './run-diff';

const run = (over: Partial<DiffableRun> = {}): DiffableRun => ({ prompt: 'a cat', model: 'nano-banana-2', params: { aspectRatio: '1:1' }, ...over });

describe('params diff between two runs', () => {
  it('is empty when nothing differs', () => {
    expect(diffRuns(run(), run())).toEqual([]);
  });

  it('lists prompt and model first, then settings', () => {
    const diff = diffRuns(run(), run({ prompt: 'a dog', model: 'flux', params: { aspectRatio: '16:9' } }));

    expect(diff).toEqual([
      { field: 'prompt', a: 'a cat', b: 'a dog' },
      { field: 'model', a: 'nano-banana-2', b: 'flux' },
      { field: 'aspectRatio', a: '1:1', b: '16:9' }
    ]);
  });

  it('shows a setting present on one side only', () => {
    expect(diffRuns(run(), run({ params: { aspectRatio: '1:1', seed: 7 } }))).toEqual([{ field: 'seed', a: null, b: 7 }]);
  });

  it('treats a null prompt and an empty one as the same', () => {
    expect(diffRuns(run({ prompt: null }), run({ prompt: '' }))).toEqual([]);
  });
});
