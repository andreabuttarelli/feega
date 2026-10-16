import { describe, expect, it } from 'vitest';
import { parseBreakdown } from '$lib/video-reference';
import { MAX_SCENE_FIXES, SCENE_PASS, parseVerdict, runReplicaLoop, type LoopPorts, type SceneStep } from './replica-loop';

const breakdown = parseBreakdown(
  JSON.stringify({
    durationS: 6,
    aspectRatio: '16:9',
    scenes: [
      { start: 0, end: 2, description: 'CAUTIVA on orange', onScreenText: ['CAUTIVA'] },
      { start: 2, end: 6, description: 'creatividad on red', onScreenText: ['creatividad'] }
    ],
    pacing: { cutsPerMinute: 20, rhythm: 'fast' }
  })
)!;

function fakePorts(scores: number[], costPerTurn = 0.5) {
  const steps: SceneStep[] = [];
  const judged: number[][] = [];
  let spent = 0;
  const ports: LoopPorts = {
    grab: async () => Buffer.from([1]),
    turn: async (step) => {
      steps.push(step);
      spent += costPerTurn;
    },
    draw: async (times) => times.map((time) => ({ time, bytes: Buffer.from([2]) })),
    judge: async (input) => {
      judged.push(input.pairs.map((p) => p.time));
      return { score: scores.shift() ?? 1, fixes: ['make the orange radial'] };
    },
    spent: async () => spent
  };
  return { ports, steps, judged };
}

describe('the replica is built scene by scene by the server, not in one go', () => {
  it('one build turn per scene, each locked to its own time range, with dense frames of that scene only', async () => {
    const { ports, steps } = fakePorts([0.9, 0.9]);

    await runReplicaLoop(breakdown, ports, { capUsd: 6 });

    expect(steps.map((s) => [s.scene, s.span])).toEqual([
      [1, { fromS: 0, toS: 2 }],
      [2, { fromS: 2, toS: 6 }]
    ]);
    expect(steps[0].pictures).toHaveLength(12);
    expect(steps[1].pictures).toHaveLength(SCENE_FRAMES_FOR_4S);
    expect(steps[0].text).toContain('CAUTIVA');
    expect(steps[0].text).not.toContain('creatividad');
  });

  it('a scene below the bar gets a fix turn with the judge notes and the side-by-side pairs, then is judged again', async () => {
    const { ports, steps } = fakePorts([0.4, 0.85, 0.9]);

    const report = await runReplicaLoop(breakdown, ports, { capUsd: 6 });

    expect(steps.map((s) => s.scene)).toEqual([1, 1, 2]);
    expect(steps[1].text).toContain('make the orange radial');
    expect(steps[1].pictures.some((p) => p.label.startsWith('Your frame'))).toBe(true);
    expect(report.map((r) => [r.scene, r.score, r.fixes])).toEqual([
      [1, 0.85, 1],
      [2, 0.9, 0]
    ]);
  });

  it('fixes stop after the limit', async () => {
    const { ports, steps } = fakePorts([0.1, 0.1, 0.1, 0.1, 0.9]);

    const report = await runReplicaLoop(breakdown, ports, { capUsd: 60 });

    expect(steps.filter((s) => s.scene === 1)).toHaveLength(1 + MAX_SCENE_FIXES);
    expect(report[0].fixes).toBe(MAX_SCENE_FIXES);
  });

  it('each scene gets an equal share of the cap, and stops fixing when its share is spent', async () => {
    const { ports, steps } = fakePorts([0.1, 0.1, 0.1, 0.9], 1.6);

    await runReplicaLoop(breakdown, ports, { capUsd: 6 });

    expect(steps[0].capUsd).toBe(3);
    expect(steps[1].capUsd).toBeCloseTo(1.4);
    expect(steps.filter((s) => s.scene === 1)).toHaveLength(2);
    expect(steps.at(-1)!.scene).toBe(2);
  });

  it('the judge sees a few reference and replica pairs of the scene', async () => {
    const { ports, judged } = fakePorts([0.9, 0.9]);

    await runReplicaLoop(breakdown, ports, { capUsd: 6 });

    expect(judged[0]).toHaveLength(4);
    judged[0].forEach((t) => expect(t).toBeLessThan(2));
  });

  it('the pass bar is a vision score of 0.8', () => {
    expect(SCENE_PASS).toBe(0.8);
  });
});

const SCENE_FRAMES_FOR_4S = 24;

describe('the vision verdict', () => {
  it('reads a 0–10 score and fixes, even in a json fence', () => {
    expect(parseVerdict('```json\n{"score": 7, "fixes": ["bigger type"]}\n```')).toEqual({ score: 0.7, fixes: ['bigger type'] });
  });

  it('prose is no verdict', () => {
    expect(parseVerdict('looks great')).toBeNull();
  });
});
