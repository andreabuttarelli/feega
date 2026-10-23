import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, findClip, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { StyleKind, StyleSlot, applyStyle, defineStyle, detachStyle, removeStyle, renameStyle, saveAsStyle, stylesFor, stylesOf } from './styles';
import { addEffect } from './effects/ops';
import { EffectKind } from './effects/registry';
import { FillType, type Fill } from './fill/model';
import { BlendMode } from './blend';
import type { Style } from './styles-model';

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

  describe('effect and paint styles', () => {
    const SHADOW: Style = { kind: StyleKind.Effect, effects: [{ id: 'sh', kind: EffectKind.DropShadow, enabled: true, params: { distance: 20, angle: 90, blur: 30, opacity: 0.6 } }] };
    const SOFT: Style = { kind: StyleKind.Effect, effects: [{ id: 'sh', kind: EffectKind.DropShadow, enabled: true, params: { distance: 8, angle: 90, blur: 10, opacity: 0.3 } }] };
    const SUNSET: Style = { kind: StyleKind.Paint, fills: [{ type: FillType.Linear, angle: 45, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 1 }], opacity: 1, visible: true, blend: BlendMode.Normal }] };

    it('an effect style gives a clip its effects and links it', () => {
      const doc = ok(applyStyle(ok(defineStyle(docWith(), 'Lifted', SHADOW)), ['s1', 't1'], 'Lifted'));

      expect(findClip(doc, 's1')!.clip.effects).toMatchObject([{ id: 'sh', kind: 'drop-shadow', params: { distance: 20, blur: 30 } }]);
      expect(findClip(doc, 't1')!.clip.effectStyleRef).toBe('Lifted');
      expect(parseMotionDoc(doc).ok).toBe(true);
    });

    it('editing an effect style updates every clip using it', () => {
      const styled = ok(applyStyle(ok(defineStyle(docWith(), 'Lifted', SHADOW)), ['s1', 't1'], 'Lifted'));
      const edited = ok(defineStyle(styled, 'Lifted', SOFT));

      expect((findClip(edited, 's1')!.clip.effects[0].params as { blur: number }).blur).toBe(10);
      expect((findClip(edited, 't1')!.clip.effects[0].params as { blur: number }).blur).toBe(10);
    });

    it('an effect style and a text style sit on the same clip', () => {
      const text = ok(applyStyle(ok(defineStyle(docWith(), 'Headline', HEADLINE)), ['t1'], 'Headline'));
      const both = ok(applyStyle(ok(defineStyle(text, 'Lifted', SHADOW)), ['t1'], 'Lifted'));
      const clip = findClip(both, 't1')!.clip;

      expect([clip.styleRef, clip.effectStyleRef]).toEqual(['Headline', 'Lifted']);
    });

    it('detaching the effect slot leaves the text style linked', () => {
      const both = ok(applyStyle(ok(defineStyle(ok(applyStyle(ok(defineStyle(docWith(), 'Headline', HEADLINE)), ['t1'], 'Headline')), 'Lifted', SHADOW)), ['t1'], 'Lifted'));
      const clip = findClip(ok(detachStyle(both, ['t1'], StyleSlot.Effect)), 't1')!.clip;

      expect([clip.styleRef, clip.effectStyleRef]).toEqual(['Headline', undefined]);
    });

    it('a paint style fills a shape with its gradient and follows edits', () => {
      const painted = ok(applyStyle(ok(defineStyle(docWith(), 'Sunset', SUNSET)), ['s1'], 'Sunset'));
      const edited = ok(defineStyle(painted, 'Sunset', { ...SUNSET, fills: [{ ...(SUNSET as { fills: Fill[] }).fills[0], angle: 90 } as Fill] }));

      expect(findClip(painted, 's1')!.clip.props.fills).toMatchObject([{ type: 'linear-gradient', angle: 45 }]);
      expect(findClip(painted, 's1')!.clip.styleRef).toBe('Sunset');
      expect(findClip(edited, 's1')!.clip.props.fills).toMatchObject([{ angle: 90 }]);
    });

    it('a paint style refuses a clip with no fill', () => {
      const withSound = ok(addClip(docWith(), { component: 'Audio', from: 0, props: {} }, 'a1'));

      expect(applyStyle(ok(defineStyle(withSound, 'Sunset', SUNSET)), ['a1'], 'Sunset').ok).toBe(false);
    });

    it('a clip saved as an effect style or a paint style takes its current look', () => {
      const shadowed = ok(addEffect(docWith(), 's1', EffectKind.DropShadow, 'e1', { blur: 40 }));
      const withEffect = ok(saveAsStyle(shadowed, 's1', 'Lifted', StyleKind.Effect));
      const withPaint = ok(saveAsStyle(docWith(), 's1', 'Fill', StyleKind.Paint));

      expect(withEffect.styles?.Lifted).toMatchObject({ kind: StyleKind.Effect, effects: [{ id: 'e1', params: { blur: 40 } }] });
      expect(findClip(withEffect, 's1')!.clip.effectStyleRef).toBe('Lifted');
      expect(withPaint.styles?.Fill).toMatchObject({ kind: StyleKind.Paint, fills: [{ type: 'solid' }] });
    });

    it('saving an effect style from a clip with no effects is refused', () => {
      expect(saveAsStyle(docWith(), 's1', 'Lifted', StyleKind.Effect).ok).toBe(false);
    });

    it('removing an effect style detaches its clips', () => {
      const styled = ok(applyStyle(ok(defineStyle(docWith(), 'Lifted', SHADOW)), ['s1'], 'Lifted'));

      expect(findClip(ok(removeStyle(styled, 'Lifted')), 's1')!.clip.effectStyleRef).toBeUndefined();
    });

    it('renaming an effect style keeps its clips on the effect slot', () => {
      const styled = ok(applyStyle(ok(defineStyle(docWith(), 'Lifted', SHADOW)), ['s1'], 'Lifted'));
      const renamed = ok(renameStyle(styled, 'Lifted', 'Raised'));

      expect(renamed.styles).toEqual({ Raised: SHADOW });
      expect(findClip(renamed, 's1')!.clip.effectStyleRef).toBe('Raised');
    });

    it('renaming a paint style keeps its clips linked', () => {
      const painted = ok(applyStyle(ok(defineStyle(docWith(), 'Sunset', SUNSET)), ['s1'], 'Sunset'));
      const renamed = ok(renameStyle(painted, 'Sunset', 'Dusk'));

      expect(renamed.styles).toEqual({ Dusk: SUNSET });
      expect(findClip(renamed, 's1')!.clip.styleRef).toBe('Dusk');
    });

    it('a title is offered effect and paint styles, audio none', () => {
      const doc = ok(defineStyle(ok(defineStyle(docWith(), 'Lifted', SHADOW)), 'Sunset', SUNSET));

      expect(stylesFor(doc, 'Title').map((s) => s.name)).toEqual(['Lifted', 'Sunset']);
      expect(stylesFor(doc, 'Audio')).toEqual([]);
    });
  });
});

describe('renaming a style', () => {
  it('moves the definition and keeps the linked elements linked', () => {
    const linked = ok(applyStyle(ok(defineStyle(docWith(), 'Headline', HEADLINE)), ['t1'], 'Headline'));
    const renamed = ok(renameStyle(linked, 'Headline', 'Display'));

    expect(renamed.styles).toEqual({ Display: HEADLINE });
    expect(findClip(renamed, 't1')!.clip.styleRef).toBe('Display');
  });

  it('refuses a missing style, a taken name and an invalid one', () => {
    const doc = ok(defineStyle(ok(defineStyle(docWith(), 'A', HEADLINE)), 'B', HEADLINE));

    expect(renameStyle(doc, 'Z', 'C').ok).toBe(false);
    expect(renameStyle(doc, 'A', 'B').ok).toBe(false);
    expect(renameStyle(doc, 'A', '!!').ok).toBe(false);
  });
});

