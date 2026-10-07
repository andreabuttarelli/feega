import { describe, expect, it } from 'vitest';
import { DeepEnd, DeepPhase, type DeepVerdict } from '$lib/motion/deep';
import { freshState, runDeep, type DeepLimits, type DeepPorts, type DeepState } from './loop';

const PASS: DeepVerdict = { pass: true, score: 9, fixes: [] };
const FAIL: DeepVerdict = { pass: false, score: 5, fixes: ['the title overflows at 3.2 s', 'the screenshot holds still for 2 s'] };

const LIMITS: DeepLimits = {
  minIterations: 2,
  maxIterations: 4,
  capUsd: 10,
  roundUsd: 1,
  phaseMs: { storyboard: 10, assets: 10, build: 10, render: 10, critique: 10, summary: 10, done: 0 }
};

type World = {
  verdicts: DeepVerdict[];
  calls: string[];
  builds: { fixes: string[]; iteration: number }[];
  checkpoints: DeepState[];
  spent: number;
  costPerBuild: number;
  stopAfter: string | null;
  remainingMs: number;
  timeLeftAfter: Record<string, number>;
  renderFails: boolean;
  critiqueFrames: number[];
};

function world(overrides: Partial<World> = {}): World {
  return { verdicts: [], calls: [], builds: [], checkpoints: [], spent: 0, costPerBuild: 0, stopAfter: null, remainingMs: 1_000_000, timeLeftAfter: {}, renderFails: false, critiqueFrames: [], ...overrides };
}

function portsOf(w: World): DeepPorts {
  const did = (name: string) => {
    w.calls.push(name);
    if (w.timeLeftAfter[name] !== undefined) {
      w.remainingMs = w.timeLeftAfter[name];
    }
  };
  return {
    direct: async () => {
      did('direct');
      return 'hook 0–2 s, three features, end card';
    },
    prepare: async () => {
      did('prepare');
      return 'imported the logo and two screenshots';
    },
    build: async (input) => {
      did('build');
      w.builds.push({ fixes: input.fixes, iteration: input.iteration });
      w.spent += w.costPerBuild;
      return 'placed five scenes';
    },
    render: async () => {
      did('render');
      if (w.renderFails) {
        throw new Error('render worker stopped');
      }
      return [{ time: 1, bytes: Buffer.from('x') }];
    },
    critique: async (input) => {
      did('critique');
      w.critiqueFrames.push(input.frames.length);
      return w.verdicts.shift() ?? PASS;
    },
    summarize: async () => {
      did('summarize');
      return 'Made a 15 s launch video.';
    },
    checkpoint: async (state) => {
      w.checkpoints.push(structuredClone(state));
    },
    stopRequested: async () => w.stopAfter !== null && w.calls.includes(w.stopAfter),
    spentUsd: () => w.spent,
    remainingMs: () => w.remainingMs
  };
}

describe('the Deep agent loop', () => {
  it('directs, prepares, then builds, renders and critiques at least twice before summing up', async () => {
    const w = world();

    const outcome = await runDeep(portsOf(w), freshState(), LIMITS);

    expect(outcome.end).toBe(DeepEnd.Finished);
    expect(w.calls).toEqual(['direct', 'prepare', 'build', 'render', 'critique', 'build', 'render', 'critique', 'summarize']);
    expect(outcome.state.phase).toBe(DeepPhase.Done);
    expect(outcome.state.summary).toBe('Made a 15 s launch video.');
  });

  it('keeps iterating until the rubric passes', async () => {
    const w = world({ verdicts: [FAIL, FAIL, PASS] });

    await runDeep(portsOf(w), freshState(), LIMITS);

    expect(w.builds.map((b) => b.iteration)).toEqual([1, 2, 3]);
  });

  it('gives the next build the fixes the critic asked for', async () => {
    const w = world({ verdicts: [FAIL, PASS] });

    await runDeep(portsOf(w), freshState(), LIMITS);

    expect(w.builds[0].fixes).toEqual([]);
    expect(w.builds[1].fixes).toEqual(FAIL.fixes);
  });

  it('stops at the iteration ceiling even when the rubric still fails', async () => {
    const w = world({ verdicts: [FAIL, FAIL, FAIL, FAIL, FAIL] });

    const outcome = await runDeep(portsOf(w), freshState(), LIMITS);

    expect(w.builds).toHaveLength(LIMITS.maxIterations);
    expect(outcome.end).toBe(DeepEnd.Finished);
    expect(outcome.state.verdict?.pass).toBe(false);
  });

  it('does not start a round the budget cannot pay for', async () => {
    const w = world({ verdicts: [FAIL, FAIL, FAIL], costPerBuild: 4.6 });

    await runDeep(portsOf(w), freshState(), LIMITS);

    expect(w.builds).toHaveLength(2);
    expect(w.calls.at(-1)).toBe('summarize');
  });

  it('stops between phases when the user asks, keeping what was built', async () => {
    const w = world({ stopAfter: 'build' });

    const outcome = await runDeep(portsOf(w), freshState(), LIMITS);

    expect(outcome.end).toBe(DeepEnd.Stopped);
    expect(w.calls).toEqual(['direct', 'prepare', 'build']);
    expect(w.checkpoints.at(-1)?.phase).toBe(DeepPhase.Done);
  });

  it('pauses with a checkpoint when the function is about to time out, and resumes from it', async () => {
    const first = world({ verdicts: [FAIL], timeLeftAfter: { build: 5 } });

    const paused = await runDeep(portsOf(first), freshState(), LIMITS);

    expect(paused.end).toBe(DeepEnd.Paused);
    expect(first.calls).toEqual(['direct', 'prepare', 'build']);
    const saved = first.checkpoints.at(-1)!;
    expect(saved.phase).toBe(DeepPhase.Render);

    const second = world({ verdicts: [FAIL, PASS] });
    const resumed = await runDeep(portsOf(second), saved, LIMITS);

    expect(resumed.end).toBe(DeepEnd.Finished);
    expect(second.calls).toEqual(['render', 'critique', 'build', 'render', 'critique', 'summarize']);
    expect(second.builds.map((b) => b.iteration)).toEqual([2]);
  });

  it('renders again when a resume lands on a critique whose frames were lost', async () => {
    const w = world();
    const state: DeepState = { ...freshState(), phase: DeepPhase.Critique, iteration: 1, storyboard: 'board' };

    await runDeep(portsOf(w), state, LIMITS);

    expect(w.calls.slice(0, 2)).toEqual(['render', 'critique']);
  });

  it('critiques from the doc alone when the render fails, and says so', async () => {
    const w = world({ renderFails: true });

    const outcome = await runDeep(portsOf(w), freshState(), LIMITS);

    expect(outcome.end).toBe(DeepEnd.Finished);
    expect(w.critiqueFrames).toEqual([0, 0]);
    expect(outcome.state.notes.some((n) => n.phase === DeepPhase.Render && /render worker stopped/.test(n.text))).toBe(true);
  });

  it('writes a note for every phase it runs', async () => {
    const w = world();

    const outcome = await runDeep(portsOf(w), freshState(), LIMITS);

    expect(outcome.state.notes.map((n) => n.phase)).toEqual([
      DeepPhase.Storyboard,
      DeepPhase.Assets,
      DeepPhase.Build,
      DeepPhase.Render,
      DeepPhase.Critique,
      DeepPhase.Build,
      DeepPhase.Render,
      DeepPhase.Critique,
      DeepPhase.Summary
    ]);
  });
});
