import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { precompose } from '@feega/motion-core/motion/precomp';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { StyleKind } from '@feega/motion-core/motion/styles-model';
import { defineVariable, removeVariable } from './variables';
import { defineStyle } from './styles';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const HALF_WIDTH = { width: 540, height: 1080 };

function nested(): MotionDoc {
  const base = newMotionDoc(MotionFormat.Square);
  const shape = ok(addClip(base, { component: 'Shape', from: 0, props: { shape: 'rect', fill: '#ff0000' } }, 's1'));
  const text = ok(addClip(shape, { component: 'Text', from: 0, props: { text: 'Hi', size: 0.1, font: 'sans' } }, 't1'));
  const comp = ok(precompose(text, ['s1', 't1'], { comp: 'card', clip: 'pc' }, 'Card'));
  const framed = { ...comp, comps: { ...comp.comps, card: { ...comp.comps.card, frame: HALF_WIDTH } } };
  const tracks = framed.comps.card.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 's1' ? { ...c, bind: { fill: 'Site/Primary' } } : c.id === 't1' ? { ...c, styleRef: 'Site Body' } : c)) }));
  return { ...framed, comps: { card: { ...framed.comps.card, tracks } } } as MotionDoc;
}

const inner = (doc: MotionDoc, id: string) => doc.comps.card.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.id === id)!;

describe('tokens reach layers nested in compositions', () => {
  it('editing a colour variable recolours a bound layer inside a composition', () => {
    const doc = ok(defineVariable(nested(), 'Site', 'Primary', { type: VarType.Colour, values: { Default: '#0055ff' } }));

    expect(inner(doc, 's1').props.fill).toBe('#0055ff');
  });

  it('removing a variable unbinds the layers inside compositions', () => {
    const bound = ok(defineVariable(nested(), 'Site', 'Primary', { type: VarType.Colour, values: { Default: '#0055ff' } }));

    expect(inner(ok(removeVariable(bound, 'Site', 'Primary')), 's1').bind).toBeUndefined();
  });

  it('editing a text style restyles a linked text inside a composition, sized in the root frame', () => {
    const doc = ok(defineStyle(nested(), 'Site Body', { kind: StyleKind.Text, font: 'mono', size: 0.05 }));

    expect(inner(doc, 't1').props.font).toBe('mono');
    expect(inner(doc, 't1').props.size).toBeCloseTo(0.1);
  });
});

describe('text styles own their measures', () => {
  it('a text style leading and tracking win over a line height and letter spacing written in px', () => {
    const base = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Text', from: 0, props: { text: 'Hi', lineHeight: '28px', letterSpacing: '1px' } }, 't1'));
    const styled = ok(defineStyle({ ...base, tracks: base.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, styleRef: 'Body' })) })) }, 'Body', { kind: StyleKind.Text, leading: 1.5, tracking: 0.02, textCase: 'upper' }));
    const props = styled.tracks.flatMap((t) => t.clips)[0].props;

    expect([props.leading, props.lineHeight, props.tracking, props.letterSpacing, props.textCase]).toEqual([1.5, '', 0.02, '', 'upper']);
  });
});
