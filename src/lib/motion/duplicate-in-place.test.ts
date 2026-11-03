import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { wrapInStack } from './layout/ops';
import { createComponent, instanceOf } from './main-component';
import { homedAt } from './canvas-components';
import { addVariant, setMembers } from './variants';
import { duplicateInPlace } from './duplicate-in-place';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const counter = (prefix: string) => {
  let n = 0;
  return () => `${prefix}${++n}`;
};

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

function frame(): MotionDoc {
  let doc = newMotionDoc(MotionFormat.Landscape);
  doc = must(addClip(doc, { component: 'Text', from: 30, durationInFrames: 60, props: { text: 'Hello', x: 0.3, y: 0.3, width: 0.2, height: 0.05 } }, 'title'));
  doc = must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Go', x: 0.5, y: 0.5, width: 0.1, height: 0.05 } }, 'label'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.6, y: 0.5, width: 0.05, height: 0.05 } }, 'icon'));
  return must(wrapInStack(doc, ['label', 'icon'], 'button', 'lane'));
}

describe('duplicate in place', () => {
  it('a copy starts where its original starts, so it shows at the same moment', () => {
    const made = duplicateInPlace(frame(), 'title', counter('n'), null);

    expect(made.ok && findClip(made.doc, made.id)!.clip.from).toBe(30);
  });

  it('a container is copied with everything inside it', () => {
    const made = duplicateInPlace(frame(), 'button', counter('n'), null);
    const copy = made.ok ? findClip(made.doc, made.id)!.clip : null;
    const inside = made.ok ? clipsOf(made.doc).filter((c) => c.parent === made.id) : [];

    expect(inside.map((c) => c.props.text ?? c.props.shape).sort()).toEqual(['Go', 'rect']);
    expect([...(copy?.autoLayout?.order ?? [])].sort()).toEqual(inside.map((c) => c.id).sort());
  });

  it('a copy of an instance is another instance of the same main', () => {
    const doc = homedAt(must(createComponent(frame(), ['button'], counter('m'), 'Button')), { m1: 'components' });
    const instance = clipsOf(doc)[0];
    const made = duplicateInPlace(doc, instance.id, counter('n'), 'screen');

    expect(made.ok && instanceOf(made.doc, made.id)!.compId).toBe('m1');
  });

  it('a copy of a main is a new main, like Figma', () => {
    const doc = must(createComponent(frame(), ['button'], counter('m'), 'Button'));
    const main = clipsOf(doc)[0];
    const made = duplicateInPlace(doc, main.id, counter('n'), 'components');
    const copied = made.ok ? instanceOf(made.doc, made.id)! : null;

    expect(copied?.compId).not.toBe('m1');
    expect(copied?.comp.component?.name).toBe('Button');
  });

  it('a copy of a variant is a new variant of its set', () => {
    const doc = must(addVariant(must(createComponent(frame(), ['button'], counter('m'), 'Button')), 'm1', { State: 'Hover' }, counter('v')));
    const main = clipsOf(doc)[0];
    const made = duplicateInPlace(doc, main.id, counter('n'), 'components');

    expect(made.ok && setMembers(made.doc, 'm1')).toHaveLength(3);
  });
});
