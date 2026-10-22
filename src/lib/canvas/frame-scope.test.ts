import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, setTransform, type OpResult } from '$lib/motion/timeline';
import { groupClips } from '$lib/motion/group';
import { Reach } from './frame-select';
import { chainTarget, enteredFrom, parentPick, scopeOf, scoped } from './frame-scope';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const shape = (doc: MotionDoc, id: string, x: number) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x, y: 0.5, width: 0.1, height: 0.1 } }, id));

function grouped() {
  let n = 0;
  const doc = must(groupClips(shape(shape(newMotionDoc(MotionFormat.Landscape), 'a', 0.2), 'b', 0.4), ['a', 'b'], () => `g${++n}`));
  const group = doc.tracks.flatMap((t) => t.clips)[0].id;
  return { doc, group, member: (id: string) => `${group}__0__${id}` };
}

describe('scopeOf', () => {
  it('reads a top-level clip as itself, at the root', () => {
    const { doc, group } = grouped();

    expect(scopeOf(doc, group)).toEqual({ scope: { path: [], prefix: '', hosts: [], parents: [] }, id: group });
  });

  it('reads a group member through the group comp', () => {
    const { doc, group, member } = grouped();
    const comp = String(findClip(doc, group)!.clip.props.comp);

    expect(scopeOf(doc, member('a'))).toEqual({ scope: { path: [comp], prefix: `${group}__0__`, hosts: [group], parents: [group] }, id: 'a' });
  });

  it('knows nothing of an id that is in no comp', () => {
    expect(scopeOf(grouped().doc, 'zzz')).toBeNull();
  });
});

describe('scoped', () => {
  it('edits a member in its comp and merges the change back', () => {
    const { doc, member } = grouped();
    const s = scoped(doc, [member('a')], 0)!;

    const merged = s.merge(must(setTransform(s.view, s.ids[0], { rotateZ: 45 })));

    expect(s.ids).toEqual(['a']);
    expect(s.scene(['b'])).toEqual([member('b')]);
    expect(scoped(merged, [member('a')], 0)!.view.tracks.flatMap((t) => t.clips).find((c) => c.id === 'a')!.transform.rotateZ).toBe(45);
  });

  it('maps a frame point through a moved group', () => {
    const { doc, group, member } = grouped();
    const moved = must(setTransform(doc, group, { x: 100 / doc.width }));
    const [x, y] = scoped(moved, [member('a')], 0)!.toView([300, 200]);

    expect(x).toBeCloseTo(200, 5);
    expect(y).toBeCloseTo(200, 5);
  });

  it('refuses picks from two different places', () => {
    const { doc, group, member } = grouped();

    expect(scoped(doc, [member('a'), group], 0)).toBeNull();
  });
});

describe('chainTarget', () => {
  const { doc, group, member } = grouped();
  const chain = [group, member('a')];

  it('a click picks the group', () => {
    expect(chainTarget(doc, chain, [], Reach.Top)).toBe(group);
  });

  it('a deep click reaches the member inside the group', () => {
    expect(chainTarget(doc, chain, [], Reach.Deep)).toBe(member('a'));
  });

  it('a click next to a picked member picks its sibling, not the group', () => {
    expect(chainTarget(doc, [group, member('b')], [member('a')], Reach.Top)).toBe(member('b'));
  });

  it('picks nothing over bare frame', () => {
    expect(chainTarget(doc, [], [], Reach.Top)).toBeNull();
  });
});

describe('enteredFrom', () => {
  const { group, member } = grouped();

  it('a double click on a picked group enters the member under the pointer', () => {
    expect(enteredFrom([group, member('a')], [group])).toBe(member('a'));
  });

  it('enters nothing when the pick is not under the pointer or has nothing inside', () => {
    expect(enteredFrom([group, member('a')], [member('a')])).toBeNull();
    expect(enteredFrom([group, member('a')], [])).toBeNull();
  });
});

describe('parentPick', () => {
  const { doc, group, member } = grouped();

  it('Esc on a member goes up to its group', () => {
    expect(parentPick(doc, member('a'))).toBe(group);
  });

  it('a top-level element has no group above it', () => {
    expect(parentPick(doc, group)).toBeNull();
  });
});
