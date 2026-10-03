import { describe, expect, it } from 'vitest';
import { checkDoc, seekPlan, unverified, verdictOf, type Shot } from './determinism';
import { MotionFormat, clipsOf, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { CheckState, sourceHash } from './component';
import { recordCheck, writeComponent } from './ops';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const shot = (time: number, image = `img@${time}`, layout = `box@${time}`): Shot => ({ time, image, layout, errors: [] });

describe('the seek-determinism check', () => {
  it('visits every check point forward, backward and in a scrambled order', () => {
    const plan = seekPlan(4, 30);
    const points = [...new Set(plan)].sort((a, b) => a - b);

    expect(points.length).toBe(5);
    expect(plan.slice(0, 5)).toEqual(points);
    expect(plan.slice(5, 10)).toEqual(points);
    expect(plan.slice(10, 15)).toEqual([...points].reverse());
    expect(plan.slice(15)).not.toEqual(points);
    expect(plan.every((t) => Number.isInteger(Math.round(t * 30)) && t < 4)).toBe(true);
  });

  it('passes when every visit of a time shows the same frame and boxes', () => {
    const plan = seekPlan(4, 30);

    expect(verdictOf(plan.map((t) => shot(t)))).toEqual({ ok: true, problems: [], offending: [] });
  });

  it('fails on a frame that depends on where the playhead came from, with both frames', () => {
    const plan = seekPlan(4, 30);
    const shots = plan.map((t, i) => (i === 12 ? shot(t, 'drifted') : shot(t)));

    const verdict = verdictOf(shots);

    expect(verdict.ok).toBe(false);
    expect(verdict.problems[0]).toMatch(/differs/);
    expect(verdict.offending.map((s) => s.image)).toEqual([`img@${plan[12]}`, 'drifted']);
  });

  it('fails on boxes that move between visits even when pixels match', () => {
    const plan = seekPlan(4, 30);
    const shots = plan.map((t, i) => (i === 17 ? shot(t, `img@${t}`, 'moved') : shot(t)));

    expect(verdictOf(shots).problems.join(' ')).toMatch(/layout/);
  });

  it('ignores the warm-up pass, where pictures and fonts may still be arriving', () => {
    const plan = seekPlan(4, 30);
    const shots = plan.map((t, i) => (i < 5 ? shot(t, 'loading', 'unsized') : shot(t)));

    expect(verdictOf(shots).ok).toBe(true);
  });

  it('reports a repeated problem once', () => {
    const plan = seekPlan(4, 30);
    const shots = plan.map((t, i) => (i >= 10 ? shot(t, `img@${t}`, 'moved') : shot(t)));

    const problems = verdictOf(shots).problems;
    expect(new Set(problems).size).toBe(problems.length);
  });

  it('fails on a component that threw', () => {
    const shots = seekPlan(4, 30).map((t) => ({ ...shot(t), errors: [{ clip: 'c', component: 'Chat', message: 'boom' }] }));

    expect(verdictOf(shots).problems).toEqual(['Chat threw: boom']);
  });
});

describe('what the check renders and what export accepts', () => {
  const draft = {
    source: { html: '<i></i>', css: '', js: '' },
    propsSchema: { type: 'object' as const, properties: { n: { type: 'number' as const, default: 1 } } }
  };
  const base = must(writeComponent(newMotionDoc(MotionFormat.Vertical), 'Pulse', draft));
  const used = must(addClip(base, { component: 'Custom', from: 60, durationInFrames: 90, props: { name: 'Pulse', n: 4 } }, 'p1'));

  it('renders the component alone, with the props and length of its first clip', () => {
    const doc = checkDoc(used, 'Pulse');
    const clips = clipsOf(doc);

    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({ from: 0, durationInFrames: 90, props: { name: 'Pulse', n: 4 } });
    expect(doc.durationInFrames).toBe(90);
    expect([doc.width, doc.height]).toEqual([used.width, used.height]);
  });

  it('blocks export while a used component has not passed the check for its current code', () => {
    expect(unverified(used)).toEqual([{ name: 'Pulse', state: CheckState.Unchecked }]);

    const passed = must(recordCheck(used, 'Pulse', { hash: sourceHash(used.components.Pulse), state: CheckState.Passed, problems: [] }));
    expect(unverified(passed)).toEqual([]);
    expect(unverified(base)).toEqual([]);
  });
});
