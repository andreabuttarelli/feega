import { describe, expect, it } from 'vitest';
import { HAIKU, MAX_SPAWN_PARALLEL, SpawnDepth, TaskKind, spawnPlan, spawnRunner, type ModelOffer } from './spawn';

const OPUS = 'anthropic/claude-opus-5.5';
const SONNET = 'anthropic/claude-sonnet-5.5';
const CATALOGUE: ModelOffer[] = [
  { id: OPUS, inputUsdPerM: 15, outputUsdPerM: 75, vision: true },
  { id: SONNET, inputUsdPerM: 3, outputUsdPerM: 15, vision: true },
  { id: HAIKU, inputUsdPerM: 1, outputUsdPerM: 5, vision: false }
];
const CALLER = { tools: ['web_search', 'read_page', 'add_shot', 'write_component', 'view_frames'], codeTools: new Set(['write_component']), visionTools: new Set(['view_frames']), catalogue: CATALOGUE, depth: SpawnDepth.Parent, remainingUsd: 1 };

describe('what a spawned agent may be', () => {
  it('takes the roster model for its kind of task when the caller names none', () => {
    expect(spawnPlan({ prompt: 'read these 3 pages', kind: TaskKind.Reading, tools: ['read_page'], budget_usd: 0.1 }, CALLER)).toMatchObject({ ok: true, model: SONNET });
    expect(spawnPlan({ prompt: 'is this a yes', kind: TaskKind.Simple, budget_usd: 0.05 }, CALLER)).toMatchObject({ ok: true, model: HAIKU, tools: [] });
    expect(spawnPlan({ prompt: 'design the end card', kind: TaskKind.Visual, tools: ['add_shot'], budget_usd: 0.3 }, CALLER)).toMatchObject({ ok: true, model: OPUS });
  });

  it('lets the caller pick any catalogue model, but a code-writing tool always runs on Opus', () => {
    expect(spawnPlan({ prompt: 'p', model: SONNET, tools: ['add_shot'], budget_usd: 0.2 }, CALLER)).toMatchObject({ ok: true, model: SONNET });
    expect(spawnPlan({ prompt: 'p', model: SONNET, tools: ['write_component'], budget_usd: 0.2 }, CALLER)).toMatchObject({ ok: true, model: OPUS });
    expect(spawnPlan({ prompt: 'p', model: 'x/unknown', budget_usd: 0.2 }, CALLER)).toMatchObject({ ok: false, error: expect.stringContaining(SONNET) });
  });

  it('refuses a model that cannot see when the task looks at frames', () => {
    expect(spawnPlan({ prompt: 'p', model: HAIKU, tools: ['view_frames'], budget_usd: 0.2 }, CALLER)).toMatchObject({ ok: false, error: expect.stringContaining('see') });
  });

  it('only hands tools the caller has, and never the power to spawn again', () => {
    expect(spawnPlan({ prompt: 'p', tools: ['delete_everything'], budget_usd: 0.1 }, CALLER)).toMatchObject({ ok: false, error: expect.stringContaining('delete_everything') });
    expect(spawnPlan({ prompt: 'p', budget_usd: 0.1 }, { ...CALLER, depth: SpawnDepth.Child })).toMatchObject({ ok: false, error: expect.stringContaining('cannot spawn') });
  });

  it('carves its budget out of what the turn has left', () => {
    expect(spawnPlan({ prompt: 'p', budget_usd: 2 }, CALLER)).toMatchObject({ ok: false, error: expect.stringContaining('$1.00 left') });
  });
});

describe('running spawned agents', () => {
  const plan = { ok: true as const, prompt: 'p', model: SONNET, tools: [], budgetUsd: 0.3, label: 'research' };

  it('holds back more than the parallel limit and reserves each budget until it ends', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const runner = spawnRunner({ run: async () => (await gate, { text: 'done', usd: 0.1, changed: ['c1'] }) }, () => 1);
    const running = Array.from({ length: MAX_SPAWN_PARALLEL }, () => runner.spawn(plan));

    expect(await runner.spawn(plan)).toMatchObject({ ok: false, error: expect.stringContaining(`${MAX_SPAWN_PARALLEL}`) });
    expect(runner.reservedUsd()).toBeCloseTo(0.3 * MAX_SPAWN_PARALLEL);
    release();
    expect(await running[0]).toEqual({ ok: true, label: 'research', model: SONNET, prompt: 'p', text: 'done', cost_usd: 0.1, changed: ['c1'] });
    await Promise.all(running);
    expect(runner.reservedUsd()).toBe(0);
  });

  it('a sub-agent that fails comes back as an error, never a throw', async () => {
    const runner = spawnRunner({ run: async () => { throw new Error('gateway down'); } }, () => 1);

    expect(await runner.spawn(plan)).toEqual({ ok: false, error: 'the sub-agent failed: gateway down' });
  });
});
