import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setProps, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
import { groupClips } from '$lib/motion/group';
import { createComponent, innerClips, instanceOf } from '$lib/motion/main-component';
import { flattenComps } from '@feega/motion-core/motion/precomp';
import { homedAt } from '$lib/motion/canvas-components';
import { addVariant } from '$lib/motion/variants';
import { Reach } from './frame-select';
import { pickTarget, enteredFrom, parentPick, scopeOf, scoped } from './frame-scope';

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

describe('scoped inside an instance', () => {
  function instance() {
    let n = 0;
    const doc = homedAt(must(createComponent(shape(shape(newMotionDoc(MotionFormat.Landscape), 'a', 0.2), 'b', 0.4), ['a', 'b'], () => `i${++n}`, 'Card')), { i1: 'components' });
    const host = doc.tracks.flatMap((t) => t.clips)[0].id;
    return { doc, host, member: (id: string) => `${host}__0__${id}` };
  }
  const xOf = (doc: MotionDoc, id: string) => findClip(doc, id)!.clip.props.x;

  it('an edit is recorded as an override of the instance and leaves the main alone', () => {
    const { doc, host, member } = instance();
    const s = scoped(doc, [member('a')], 0)!;
    const merged = s.merge(must(setProps(s.view, 'a', { x: 0.9 })));

    expect(instanceOf(merged, host)!.overrides).toEqual({ a: { x: 0.9 } });
    expect(innerClips(instanceOf(merged, host)!.comp).find((c) => c.id === 'a')!.props.x).toBe(0.2);
  });

  it('a drag, which writes the transform, is recorded too', () => {
    const { doc, host, member } = instance();
    const s = scoped(doc, [member('a')], 0)!;
    const merged = s.merge(must(setTransform(s.view, 'a', { x: 0.25 })));

    expect(instanceOf(merged, host)!.overrides.a.transform).toMatchObject({ x: 0.25 });
  });

  it('shows the instance values, not the main ones, once overridden', () => {
    const { doc, member } = instance();
    const s = scoped(doc, [member('a')], 0)!;
    const merged = s.merge(must(setProps(s.view, 'a', { x: 0.9 })));

    expect(xOf(scoped(merged, [member('a')], 0)!.view, 'a')).toBe(0.9);
  });

  it('an element dragged back to the main value stops being an override', () => {
    const { doc, host, member } = instance();
    const s = scoped(doc, [member('a')], 0)!;
    const moved = s.merge(must(setProps(s.view, 'a', { x: 0.9 })));
    const again = scoped(moved, [member('a')], 0)!;
    const back = again.merge(must(setProps(again.view, 'a', { x: 0.2 })));

    expect(instanceOf(back, host)!.clip.props.overrides).toBeUndefined();
  });

  it('a plain group still edits its own comp', () => {
    const { doc, group, member } = grouped();
    const s = scoped(doc, [member('a')], 0)!;
    const merged = s.merge(must(setProps(s.view, 'a', { x: 0.9 })));

    expect(findClip(merged, group)!.clip.props.overrides).toBeUndefined();
    expect(xOf(scoped(merged, [member('a')], 0)!.view, 'a')).toBe(0.9);
  });
});

describe('scoped inside a main', () => {
  function main(home?: string) {
    let n = 0;
    const made = must(createComponent(shape(shape(newMotionDoc(MotionFormat.Landscape), 'a', 0.2), 'b', 0.4), ['a', 'b'], () => `m${++n}`, 'Card'));
    const doc = home ? homedAt(made, { m1: home }) : made;
    const host = doc.tracks.flatMap((t) => t.clips)[0].id;
    return { doc, host, member: (id: string) => `${host}__0__${id}` };
  }
  const mainX = (doc: MotionDoc, host: string) => innerClips(instanceOf(doc, host)!.comp).find((c) => c.id === 'a')!.props.x;

  it('an edit inside a main not yet homed changes the main itself', () => {
    const { doc, host, member } = main();
    const s = scoped(doc, [member('a')], 0, 'frame')!;
    const merged = s.merge(must(setProps(s.view, 'a', { x: 0.9 })));

    expect(mainX(merged, host)).toBe(0.9);
    expect(instanceOf(merged, host)!.clip.props.overrides).toBeUndefined();
  });

  it('an edit inside the main in its home frame changes the main itself', () => {
    const { doc, host, member } = main('components');
    const s = scoped(doc, [member('a')], 0, 'components')!;
    const merged = s.merge(must(setProps(s.view, 'a', { x: 0.9 })));

    expect(mainX(merged, host)).toBe(0.9);
  });

  it('the same comp seen from another frame is an instance', () => {
    const { doc, host, member } = main('components');
    const s = scoped(doc, [member('a')], 0, 'screen')!;
    const merged = s.merge(must(setProps(s.view, 'a', { x: 0.9 })));

    expect(mainX(merged, host)).toBe(0.2);
    expect(instanceOf(merged, host)!.overrides).toEqual({ a: { x: 0.9 } });
  });
});

describe('scoped inside one variant of a set', () => {
  it('an edit inside one variant leaves the other variants alone', () => {
    let n = 0;
    const made = must(createComponent(shape(newMotionDoc(MotionFormat.Landscape), 'a', 0.2), ['a'], () => `m${++n}`, 'Chip'));
    const set = must(addVariant(made, 'm1', { State: 'Hover' }, () => 'v2'));
    const both = must(addClip(set, { component: 'Precomp', from: 0, durationInFrames: 90, props: { comp: 'v2' } }, 'h2'));
    const s = scoped(both, ['h2__0__a'], 0, 'set')!;
    const merged = s.merge(must(setProps(s.view, 'a', { x: 0.9 })));
    const xIn = (comp: string) => merged.comps[comp].tracks.flatMap((t) => t.clips).find((c) => c.id === 'a')!.props.x;

    expect(xIn('v2')).toBe(0.9);
    expect(xIn('m1')).toBe(0.2);
  });
});

describe('a text override on a button nested in a card instance', () => {
  function screen() {
    let n = 0;
    const id = () => `n${++n}`;
    const label = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Buy', x: 0.3, y: 0.5, width: 0.1, height: 0.05 } }, 'label'));
    const button = must(createComponent(label, ['label'], id, 'Button'));
    const card = homedAt(must(createComponent(button, ['n2'], id, 'Card')), { n1: 'buttons', n3: 'cards' });
    return { doc: card, card: 'n4', nested: 'n4__0__n2__0__label' };
  }
  const texts = (doc: MotionDoc) => flattenComps(doc).tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Text').map((c) => c.props.text);

  it('changes that card only, as an override on the card instance', () => {
    const { doc, card, nested } = screen();
    const s = scoped(doc, [nested], 0, 'screen')!;
    const merged = s.merge(must(setProps(s.view, 'label', { text: 'Sold out' })));

    expect(texts(merged)).toEqual(['Sold out']);
    expect(instanceOf(merged, card)!.comp.tracks.flatMap((t) => t.clips).find((c) => c.id === 'n2')!.props.overrides).toBeUndefined();
    expect(instanceOf(merged, card)!.overrides).toEqual({ n2: { overrides: { label: { text: 'Sold out' } } } });
  });

  it('shows the override when the text is entered again', () => {
    const { doc, nested } = screen();
    const s = scoped(doc, [nested], 0, 'screen')!;
    const merged = s.merge(must(setProps(s.view, 'label', { text: 'Sold out' })));
    const again = scoped(merged, [nested], 0, 'screen')!;

    expect(findClip(again.view, 'label')!.clip.props.text).toBe('Sold out');
  });
});

describe('pickTarget', () => {
  const { doc, group, member } = grouped();
  const chain = [group, member('a')];

  it('a click picks the group', () => {
    expect(pickTarget(doc, chain, [], Reach.Top)).toBe(group);
  });

  it('a deep click reaches the member inside the group', () => {
    expect(pickTarget(doc, chain, [], Reach.Deep)).toBe(member('a'));
  });

  it('a click next to a picked member picks its sibling, not the group', () => {
    expect(pickTarget(doc, [group, member('b')], [member('a')], Reach.Top)).toBe(member('b'));
  });

  it('picks nothing over bare frame', () => {
    expect(pickTarget(doc, [], [], Reach.Top)).toBeNull();
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
