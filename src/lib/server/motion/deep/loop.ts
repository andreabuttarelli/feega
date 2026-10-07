import { DeepEnd, DeepPhase, type DeepState, type DeepVerdict } from '$lib/motion/deep';
import type { Frame } from '$lib/server/motion/frames';

export type { DeepState };

export type DeepPorts = {
  direct: () => Promise<string>;
  prepare: (storyboard: string) => Promise<string>;
  build: (input: { storyboard: string; fixes: string[]; iteration: number }) => Promise<string>;
  render: () => Promise<Frame[]>;
  critique: (input: { storyboard: string; frames: Frame[] }) => Promise<DeepVerdict>;
  summarize: (state: DeepState) => Promise<string>;
  checkpoint: (state: DeepState) => Promise<void>;
  stopRequested: () => Promise<boolean>;
  spentUsd: () => number;
  version: () => number;
  restore: (version: number) => Promise<void>;
  remainingMs: () => number;
};

export type DeepLimits = {
  minIterations: number;
  maxIterations: number;
  capUsd: number;
  roundUsd: number;
  phaseMs: Record<DeepPhase, number>;
};

export type DeepOutcome = { end: DeepEnd; state: DeepState };

type Step = { next: DeepPhase; note: string };

type Run = { state: DeepState; frames: Frame[] | null; ports: DeepPorts; limits: DeepLimits };

export function freshState(): DeepState {
  return { phase: DeepPhase.Storyboard, iteration: 0, storyboard: null, verdict: null, best: null, notes: [], summary: null };
}

type Closing = { because: string; applies: (run: Run, verdict: DeepVerdict) => boolean };

const CLOSINGS: Closing[] = [
  { because: 'reached the iteration ceiling', applies: (run) => run.state.iteration >= run.limits.maxIterations },
  { because: 'the rubric passes', applies: (run, verdict) => verdict.pass && run.state.iteration >= run.limits.minIterations },
  { because: 'the budget cannot pay for another round', applies: (run) => run.ports.spentUsd() + run.limits.roundUsd > run.limits.capUsd }
];

enum Trend {
  Better = 'better',
  Worse = 'worse'
}

const trendOf = (best: DeepState['best'], verdict: DeepVerdict) => (best && verdict.score < best.verdict.score ? Trend.Worse : Trend.Better);

const KEEP: Record<Trend, (run: Run, verdict: DeepVerdict) => Promise<{ verdict: DeepVerdict; note: string }>> = {
  [Trend.Better]: async (run, verdict) => {
    run.state.best = { verdict, version: run.ports.version() };
    return { verdict, note: '' };
  },
  [Trend.Worse]: async (run, verdict) => {
    const best = run.state.best!;
    await run.ports.restore(best.version);
    return { verdict: best.verdict, note: `; scored ${verdict.score}, worse than ${best.verdict.score}: back to the best version (v${best.version})` };
  }
};

const verdictLine = (verdict: DeepVerdict) => `score ${verdict.score}/10, ${verdict.pass ? 'passes' : 'fails'} the rubric${verdict.fixes.length ? `: ${verdict.fixes.length} fixes` : ''}`;

const PHASES: Record<DeepPhase, (run: Run) => Promise<Step>> = {
  [DeepPhase.Storyboard]: async (run) => {
    run.state.storyboard = await run.ports.direct();
    return { next: DeepPhase.Assets, note: 'storyboard ready' };
  },
  [DeepPhase.Assets]: async (run) => ({ next: DeepPhase.Build, note: await run.ports.prepare(run.state.storyboard ?? '') }),
  [DeepPhase.Build]: async (run) => {
    run.state.iteration += 1;
    const fixes = run.state.verdict?.fixes ?? [];
    return { next: DeepPhase.Render, note: await run.ports.build({ storyboard: run.state.storyboard ?? '', fixes, iteration: run.state.iteration }) };
  },
  [DeepPhase.Render]: async (run) => {
    try {
      run.frames = await run.ports.render();
      return { next: DeepPhase.Critique, note: `${run.frames.length} frames rendered` };
    } catch (e) {
      run.frames = [];
      return { next: DeepPhase.Critique, note: `render failed, critique from the doc only: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
  [DeepPhase.Critique]: async (run) => {
    const seen = await run.ports.critique({ storyboard: run.state.storyboard ?? '', frames: run.frames ?? [] });
    run.frames = null;
    const kept = await KEEP[trendOf(run.state.best, seen)](run, seen);
    const verdict = kept.verdict;
    run.state.verdict = verdict;
    const closing = CLOSINGS.find((c) => c.applies(run, verdict));
    return { next: closing ? DeepPhase.Summary : DeepPhase.Build, note: `${verdictLine(seen)}${kept.note}${closing ? `; closing: ${closing.because}` : ''}` };
  },
  [DeepPhase.Summary]: async (run) => {
    run.state.summary = await run.ports.summarize(run.state);
    return { next: DeepPhase.Done, note: 'summary written' };
  },
  [DeepPhase.Done]: async () => ({ next: DeepPhase.Done, note: '' })
};

function resumedPhase(run: Run): DeepPhase {
  return run.state.phase === DeepPhase.Critique && !run.frames ? DeepPhase.Render : run.state.phase;
}

function noted(state: DeepState, phase: DeepPhase, text: string): DeepState {
  return { ...state, notes: [...state.notes, { phase, iteration: state.iteration, text, at: new Date().toISOString() }] };
}

export async function runDeep(ports: DeepPorts, start: DeepState, limits: DeepLimits): Promise<DeepOutcome> {
  const run: Run = { state: structuredClone(start), frames: null, ports, limits };
  run.state.phase = resumedPhase(run);

  while (run.state.phase !== DeepPhase.Done) {
    if (await ports.stopRequested()) {
      run.state = { ...run.state, phase: DeepPhase.Done };
      await ports.checkpoint(run.state);
      return { end: DeepEnd.Stopped, state: run.state };
    }
    if (ports.remainingMs() < limits.phaseMs[run.state.phase]) {
      await ports.checkpoint(run.state);
      return { end: DeepEnd.Paused, state: run.state };
    }

    await ports.checkpoint(run.state);
    const phase = run.state.phase;
    const step = await PHASES[phase](run);
    run.state = { ...noted(run.state, phase, step.note), phase: step.next };
  }

  await ports.checkpoint(run.state);
  return { end: DeepEnd.Finished, state: run.state };
}
