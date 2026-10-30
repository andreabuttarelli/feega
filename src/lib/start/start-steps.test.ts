import { describe, expect, it, vi } from 'vitest';
import { StartStep, StepState, runStart, type StartPorts } from './start-steps';

const URL_IN = 'https://stripe.com/';
const SCOPE = { projectId: 'p1', canvasId: 'c1' };

function ports(over: Partial<StartPorts> = {}): StartPorts {
  return {
    create: vi.fn(async () => SCOPE),
    importPage: vi.fn(async () => true),
    brand: vi.fn(async () => true),
    ...over
  };
}

function trail() {
  const seen: [StartStep, StepState][] = [];
  return { seen, report: (step: StartStep, state: StepState) => void seen.push([step, state]) };
}

describe('the start page runs its steps in order, each reported as it really goes', () => {
  it('read, import, brand, open — all done', async () => {
    const t = trail();
    const p = ports();

    const done = await runStart(URL_IN, p, t.report);

    expect(t.seen).toEqual([
      [StartStep.Read, StepState.Running],
      [StartStep.Read, StepState.Done],
      [StartStep.Import, StepState.Running],
      [StartStep.Import, StepState.Done],
      [StartStep.Brand, StepState.Running],
      [StartStep.Brand, StepState.Done],
      [StartStep.Open, StepState.Running]
    ]);
    expect(p.importPage).toHaveBeenCalledWith(SCOPE, URL_IN);
    expect(p.brand).toHaveBeenCalledWith(SCOPE, URL_IN);
    expect(done).toEqual({ scope: SCOPE, imported: true, branded: true, next: '/p/p1/c/c1' });
  });

  it('a failed import still runs the brand, and the canvas offers the import again', async () => {
    const t = trail();
    const done = await runStart(URL_IN, ports({ importPage: vi.fn(async () => false) }), t.report);

    expect(t.seen).toContainEqual([StartStep.Import, StepState.Failed]);
    expect(t.seen).toContainEqual([StartStep.Brand, StepState.Done]);
    expect(done.next).toBe(`/p/p1/c/c1?start_url=${encodeURIComponent(URL_IN)}`);
  });

  it('a failed brand analysis still has a canvas to open, and does not open it by itself', async () => {
    const t = trail();
    const done = await runStart(URL_IN, ports({ brand: vi.fn(async () => false) }), t.report);

    expect(t.seen).toContainEqual([StartStep.Brand, StepState.Failed]);
    expect(t.seen).not.toContainEqual([StartStep.Open, StepState.Running]);
    expect(done).toMatchObject({ imported: true, branded: false, next: '/p/p1/c/c1' });
  });

  it('a step that throws counts as failed, never as stuck', async () => {
    const t = trail();
    const done = await runStart(URL_IN, ports({ importPage: vi.fn(async () => { throw new Error('network'); }) }), t.report);

    expect(t.seen).toContainEqual([StartStep.Import, StepState.Failed]);
    expect(done.branded).toBe(true);
  });

  it('without a project nothing else runs, and the way out is the dashboard', async () => {
    const t = trail();
    const p = ports({ create: vi.fn(async () => null) });

    const done = await runStart(URL_IN, p, t.report);

    expect(t.seen).toEqual([[StartStep.Read, StepState.Running], [StartStep.Read, StepState.Failed]]);
    expect(p.importPage).not.toHaveBeenCalled();
    expect(done).toEqual({ scope: null, imported: false, branded: false, next: '/app' });
  });
});
