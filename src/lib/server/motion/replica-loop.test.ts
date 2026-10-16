import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { parseBreakdown } from '$lib/video-reference';
import { MAX_SCENE_FIXES, REVIEW_PAIRS, runReplicaLoop, type KeptFrame, type LoopPorts, type SceneStep } from './replica-loop';

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

const orange = await sharp({ create: { width: 16, height: 9, channels: 3, background: '#ff6a00' } }).jpeg().toBuffer();
const black = await sharp({ create: { width: 16, height: 9, channels: 3, background: '#000000' } }).jpeg().toBuffer();

function fakePorts(editsPerTurn: number[], costPerTurn = 0.5) {
  const steps: SceneStep[] = [];
  const kept: { scene: number; frames: KeptFrame[] }[] = [];
  let spent = 0;
  const ports: LoopPorts = {
    grab: async () => orange,
    turn: async (step) => {
      steps.push(step);
      spent += costPerTurn;
      return { edits: editsPerTurn.shift() ?? 0 };
    },
    draw: async (times) => times.map((time) => ({ time, bytes: black })),
    spent: async () => spent,
    keep: async (scene, frames) => void kept.push({ scene, frames })
  };
  return { ports, steps, kept };
}

const reviews = (steps: SceneStep[], scene: number) => steps.filter((s) => s.scene === scene && s.review);

describe('the replica is built scene by scene by the server, and Opus reviews each scene itself', () => {
  it('one build turn per scene, each locked to its own time range, with dense frames of that scene only', async () => {
    const { ports, steps } = fakePorts([3, 0, 3, 0]);

    await runReplicaLoop(breakdown, ports, { capUsd: 6 });

    const builds = steps.filter((s) => !s.review);
    expect(builds.map((s) => [s.scene, s.span])).toEqual([
      [1, { fromS: 0, toS: 2 }],
      [2, { fromS: 2, toS: 6 }]
    ]);
    expect(builds[0].pictures).toHaveLength(12);
    expect(builds[1].pictures).toHaveLength(24);
    expect(builds[0].text).toContain('CAUTIVA');
    expect(builds[0].text).not.toContain('creatividad');
  });

  it('the review turn receives the reference and our frame side by side, at the same times, and is told to edit, not explain', async () => {
    const { ports, steps } = fakePorts([3, 0, 3, 0]);

    await runReplicaLoop(breakdown, ports, { capUsd: 6 });

    const review = reviews(steps, 1)[0];
    expect(review.pictures.length).toBeGreaterThan(0);
    expect(review.pictures.map((p) => p.label.split(' ')[0])).toEqual(review.pictures.map((_, i) => (i % 2 ? 'Yours' : 'Reference')));
    expect(review.pictures[0].label.replace('Reference', '')).toBe(review.pictures[1].label.replace('Yours', ''));
    expect(review.pictures[1].bytes).toBe(black);
    expect(review.text).toMatch(/fix the differences now; reply only with edits/);
  });

  it('a review turn with no edits means the scene matches: the loop moves on', async () => {
    const { ports, steps } = fakePorts([3, 0, 3, 0]);

    const report = await runReplicaLoop(breakdown, ports, { capUsd: 6 });

    expect(reviews(steps, 1)).toHaveLength(1);
    expect(report.map((r) => [r.scene, r.reviews, r.matched])).toEqual([
      [1, 1, true],
      [2, 1, true]
    ]);
  });

  it('a review that keeps editing is redrawn and reviewed again, up to the limit', async () => {
    const { ports, steps } = fakePorts([3, 2, 2, 2, 2, 3, 0]);

    const report = await runReplicaLoop(breakdown, ports, { capUsd: 60 });

    expect(reviews(steps, 1)).toHaveLength(MAX_SCENE_FIXES);
    expect(report[0]).toMatchObject({ reviews: MAX_SCENE_FIXES, matched: false });
  });

  it('each scene gets an equal share of the cap, and stops reviewing when its share is spent', async () => {
    const { ports, steps } = fakePorts([3, 2, 2, 2, 3, 0], 1.6);

    await runReplicaLoop(breakdown, ports, { capUsd: 6 });

    expect(steps[0].capUsd).toBe(3);
    expect(steps[1].capUsd).toBeCloseTo(1.4);
    expect(steps.filter((s) => s.scene === 1)).toHaveLength(2);
  });

  it('a frame drawing that crashes leaves the scene unreviewed and the build goes on (live: "Connection closed." failed the whole run)', async () => {
    const { ports, steps } = fakePorts([3, 3]);

    const report = await runReplicaLoop(breakdown, { ...ports, draw: async () => Promise.reject(new Error('Connection closed.')) }, { capUsd: 6 });

    expect(steps.map((s) => s.scene)).toEqual([1, 2]);
    expect(report.map((r) => r.reviews)).toEqual([0, 0]);
  });

  it('keeps the reference frames and every round of our frames per scene, to inspect', async () => {
    const { ports, kept } = fakePorts([3, 0, 3, 0]);

    await runReplicaLoop(breakdown, ports, { capUsd: 6 });

    const scene1 = kept.filter((k) => k.scene === 1).flatMap((k) => k.frames);
    expect(scene1.some((f) => f.kind === 'reference')).toBe(true);
    expect(scene1.some((f) => f.kind === 'ours' && f.round === 1)).toBe(true);
  });

  it('logs a cheap pixel similarity, not used as the gate', async () => {
    const { ports } = fakePorts([3, 0, 3, 0]);

    const report = await runReplicaLoop(breakdown, ports, { capUsd: 6 });

    expect(report[0].similarity).toBeLessThan(0.6);
  });

  it('reviews up to a handful of pairs', () => {
    expect(REVIEW_PAIRS).toBe(6);
  });
});
