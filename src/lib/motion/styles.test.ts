import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, findClip, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { StyleKind, applyStyle, defineStyle, detachStyle, removeStyle, saveAsStyle, stylesFor, stylesOf } from './styles';

function docWith(): MotionDoc {
  const base = newMotionDoc(MotionFormat.Square);
  const a = addClip(base, { component: 'Title', from: 0, props: {} }, 't1');
  if (!a.ok) {
    throw new Error(a.error);
  }
  const b = addClip(a.doc, { component: 'Text', from: 0, props: {} }, 't2');
  if (!b.ok) {
    throw new Error(b.error);
  }
  const c = addClip(b.doc, { component: 'Shape', from: 0, props: { shape: 'rect' } }, 's1');
  if (!c.ok) {
    throw new Error(c.error);
  }
  return c.doc;
}

function ok(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const HEADLINE = { kind: StyleKind.Text, size: 0.2, weight: 600, tracking: -0.05, leading: 0.9, color: '#ff0000' } as const;

describe('named styles', () => {
  it('an old doc without styles still parses', () => {
    const doc = docWith();
    expect(parseMotionDoc(doc).ok).toBe(true);
    expect(stylesOf(doc)).toEqual([]);
  });

  it('applying a text style writes its props and links the clip', () => {
    const doc = ok(applyStyle(ok(defineStyle(docWith(), 'Headline', HEADLINE)), ['t1', 't2'], 'Headline'));
    const t1 = findClip(doc, 't1')!.clip;

    expect(t1.props.size).toBe(0.2);
    expect(t1.props.color).toBe('#ff0000');
    expect(t1.styleRef).toBe('Headline');
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('editing a style updates every clip using it', () => {
    const styled = ok(applyStyle(ok(defineStyle(docWith(), 'Headline', HEADLINE)), ['t1', 't2'], 'Headline'));
    const edited = ok(defineStyle(styled, 'Headline', { ...HEADLINE, size: 0.3 }));

    expect(findClip(edited, 't1')!.clip.props.size).toBe(0.3);
    expect(findClip(edited, 't2')!.clip.props.size).toBe(0.3);
  });

  it('a colour style paints a shape fill', () => {
    const doc = ok(applyStyle(ok(defineStyle(docWith(), 'Brand', { kind: StyleKind.Colour, color: '#00ff00' })), ['s1'], 'Brand'));
    const fills = findClip(doc, 's1')!.clip.props.fills as { color: string }[];

    expect(fills[0].color).toBe('#00ff00');
  });

  it('a text style refuses a clip without text', () => {
    expect(applyStyle(ok(defineStyle(docWith(), 'Headline', HEADLINE)), ['s1'], 'Headline').ok).toBe(false);
  });

  it('an unknown style is refused', () => {
    expect(applyStyle(docWith(), ['t1'], 'Nope').ok).toBe(false);
  });

  it('a detached clip no longer follows the style', () => {
    const styled = ok(applyStyle(ok(defineStyle(docWith(), 'Headline', HEADLINE)), ['t1'], 'Headline'));
    const edited = ok(defineStyle(ok(detachStyle(styled, ['t1'])), 'Headline', { ...HEADLINE, size: 0.3 }));

    expect(findClip(edited, 't1')!.clip.props.size).toBe(0.2);
    expect(findClip(edited, 't1')!.clip.styleRef).toBeUndefined();
  });

  it('removing a style detaches its clips', () => {
    const styled = ok(applyStyle(ok(defineStyle(docWith(), 'Headline', HEADLINE)), ['t1'], 'Headline'));
    const removed = ok(removeStyle(styled, 'Headline'));

    expect(stylesOf(removed)).toEqual([]);
    expect(findClip(removed, 't1')!.clip.styleRef).toBeUndefined();
  });

  it('a clip saved as a style takes its current look and follows it', () => {
    const doc = ok(saveAsStyle(docWith(), 't1', 'Hero', StyleKind.Text));
    const t1 = findClip(doc, 't1')!.clip;

    expect(doc.styles?.Hero).toMatchObject({ kind: StyleKind.Text, size: t1.props.size, weight: t1.props.weight });
    expect(t1.styleRef).toBe('Hero');
  });

  it('a shape is offered colour styles only', () => {
    const doc = ok(defineStyle(ok(defineStyle(docWith(), 'Headline', HEADLINE)), 'Brand', { kind: StyleKind.Colour, color: '#00ff00' }));

    expect(stylesFor(doc, 'Shape').map((s) => s.name)).toEqual(['Brand']);
    expect(stylesFor(doc, 'Title').map((s) => s.name)).toEqual(['Headline', 'Brand']);
  });
});
