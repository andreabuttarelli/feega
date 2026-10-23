import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { defineStyle } from './styles';
import { StyleKind, type Style } from './styles-model';
import { EffectKind } from './effects/registry';
import { FillType } from './fill/model';
import { BlendMode } from './blend';
import { adoptStyle, libraryOf, offeredStyles, styleLabel, syncedDoc } from './style-library';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const RED = { kind: StyleKind.Colour, color: '#ff0000' } as const;
const BLUE = { kind: StyleKind.Colour, color: '#0000ff' } as const;

const withText = () => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'a' } }, 't'));

describe('the styles library shared by the frames of a canvas', () => {
  it('is every frame style, matched by name', () => {
    const a = must(defineStyle(withText(), 'Brand', RED));
    const b = must(defineStyle(withText(), 'Accent', BLUE));
    expect(libraryOf([a, b])).toEqual({ Brand: RED, Accent: BLUE });
  });

  it('applying a style a frame lacks copies it in and links the element', () => {
    const doc = must(adoptStyle(withText(), ['t'], 'Brand', RED));
    expect(doc.styles?.Brand).toEqual(RED);
    expect(findClip(doc, 't')!.clip.styleRef).toBe('Brand');
    expect(findClip(doc, 't')!.clip.props.color).toBe('#ff0000');
  });

  it('editing a style restyles the frames that use it and leaves the others alone', () => {
    const using = must(adoptStyle(withText(), ['t'], 'Brand', RED));
    const synced = syncedDoc(using, 'Brand', BLUE)!;
    expect(findClip(synced, 't')!.clip.props.color).toBe('#0000ff');
    expect(syncedDoc(withText(), 'Brand', BLUE)).toBeNull();
  });

  it('an element is offered its frame styles and the canvas ones it can take', () => {
    const doc = must(defineStyle(withText(), 'Brand', RED));
    expect(offeredStyles(doc, 'Text', { Accent: BLUE }).map((s) => [s.name, s.shared])).toEqual([
      ['Accent', true],
      ['Brand', false]
    ]);
  });

  it('an effect style is shared like any other: adopted by an element, restyled on edit', () => {
    const shadow = (blur: number): Style => ({ kind: StyleKind.Effect, effects: [{ id: 'sh', kind: EffectKind.DropShadow, enabled: true, params: { blur } }] });
    const using = must(adoptStyle(withText(), ['t'], 'Lifted', shadow(30)));
    const synced = syncedDoc(using, 'Lifted', shadow(5))!;

    expect(findClip(using, 't')!.clip.effectStyleRef).toBe('Lifted');
    expect((findClip(synced, 't')!.clip.effects[0].params as { blur: number }).blur).toBe(5);
  });

  it('names a style by what it holds', () => {
    expect(styleLabel({ kind: StyleKind.Colour, color: '#ff0000' })).toBe('Colour');
    expect(styleLabel({ kind: StyleKind.Effect, effects: [{ id: 'a', kind: EffectKind.DropShadow, enabled: true, params: {} }, { id: 'b', kind: EffectKind.GaussianBlur, enabled: true, params: {} }] })).toBe('Drop shadow + Gaussian blur');
    expect(styleLabel({ kind: StyleKind.Paint, fills: [{ type: FillType.Linear, angle: 0, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }], opacity: 1, visible: true, blend: BlendMode.Normal }] })).toBe('Linear');
  });
});
