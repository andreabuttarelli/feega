import { describe, expect, it } from 'vitest';
import { springMath, springSource } from '../spring';
import { DEFAULT_REEL, reelMath, type ReelInput } from './reel';
import { reelSource, seamProblems } from './seam';

const reel = reelMath(springMath());
const PALETTE = { ink: '#0a0a0a', paper: '#ffffff', accent: '#ff5a1f', mute: '#e4e1db' };
const INPUT: ReelInput = { states: DEFAULT_REEL, bpm: 120, offset: 0, frame: 1080, palette: PALETTE };
const FPS = 60;

describe('the UI morph reel', () => {
  it('lasts fourteen bars at 120 BPM: one change every two beats, never one per beat', () => {
    const plan = reel.plan(INPUT);

    expect(plan.period).toBeCloseTo(28, 9);
    expect(plan.step).toBe(1);
  });

  it('puts one event on every step from the downbeat, each held long enough to read', () => {
    const plan = reel.plan(INPUT);
    const steps = new Set(plan.cues.map((t) => Math.round(t / plan.step) % 28));
    const gaps = plan.cues.map((t, i) => (plan.cues[(i + 1) % plan.cues.length] - t + plan.period) % plan.period);

    expect(plan.cues[0]).toBeCloseTo(0, 9);
    expect([...Array(28).keys()].filter((s) => !steps.has(s))).toEqual([]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(plan.step - 1e-9);
  });

  it('is a pure function of time: a frame does not depend on the frames asked before it', () => {
    const plan = reel.plan(INPUT);
    const at = [3.3, 0.2, 9.1, 3.3].map((t) => reel.frameAt(plan, t));

    expect(at[3]).toEqual(at[0]);
  });

  it('the last frame flows into the first: values, velocities and the cursor match across the seam', () => {
    expect(seamProblems(reel.plan(INPUT), FPS)).toEqual([]);
  });

  it('while the knob is held its value comes from the cursor, and on release it springs from where it was', () => {
    const plan = reel.plan(INPUT);
    const drag = plan.drags.find((d) => d.channel === 'prog')!;
    const mid = (drag.press + drag.release) / 2;
    const f = reel.frameAt(plan, mid).values;

    expect(f.prog).toBeCloseTo((f.curX - drag.x0) / (drag.x1 - drag.x0), 9);
    expect(reel.frameAt(plan, drag.release + 1e-6).values.prog).toBeCloseTo(reel.frameAt(plan, drag.release - 1e-6).values.prog, 4);
  });

  it('a volume pulled past its maximum stretches with resistance and settles back on the maximum', () => {
    const plan = reel.plan(INPUT);
    const drag = plan.drags.find((d) => d.channel === 'vol')!;
    const pulled = reel.frameAt(plan, drag.release - 0.01).values;

    expect(pulled.vol).toBeGreaterThan(1);
    expect(pulled.vol - 1).toBeLessThan((pulled.curX - drag.x1) / (drag.x1 - drag.x0));
    expect(reel.frameAt(plan, drag.release + 1.5).values.vol).toBeCloseTo(1, 2);
  });

  it('the camera zooms so each state fills the frame', () => {
    const plan = reel.plan(INPUT);
    const small = reel.fit(reel.library.loader.box, 1080);
    const large = reel.fit(reel.library.chart.box, 1080);

    expect(small).toBeGreaterThan(large * 2);
    expect(reel.library.chart.box.w * large).toBeLessThanOrEqual(1080 * 0.74 + 1e-9);
    expect(reel.frameAt(plan, 0.9).values.cam).toBeGreaterThan(reel.frameAt(plan, 16.5).values.cam);
  });

  it('typing filters the command palette as it goes', () => {
    const plan = reel.plan(INPUT);
    const typed = plan.typing.filter((k) => k.text === 'expo')[0];
    const after = reel.frameAt(plan, typed.at + 0.9);

    expect(after.typed).toBe('expo');
    expect(reel.items.filter((_, i) => after.values[`row${i}`] > 0.5)).toEqual(['Export chart', 'Export as CSV']);
  });

  it('runs the same once serialised for the browser as here', () => {
    const shipped = new Function(`return (${reelSource()})`)() as typeof reel;
    const plan = shipped.plan(INPUT);

    expect(shipped.frameAt(plan, 5.55)).toEqual(reel.frameAt(reel.plan(INPUT), 5.55));
    expect(new Function(`return ${springSource()}`)().springTrack([[0, 0], [0.1, 1]], 0.3, { stiffness: 200, damping: 20 })).toBeGreaterThan(0.5);
  });

  it('names a reel that cannot loop', () => {
    const plan = reel.plan(INPUT);
    const broken = { ...plan, steps: { ...plan.steps, w: { ...plan.steps.w, steps: [...plan.steps.w.steps, { at: 3, delta: 50, spring: { stiffness: 300, damping: 30 } }] } } };

    expect(seamProblems(broken, FPS)[0]).toContain('w ');
  });
});
