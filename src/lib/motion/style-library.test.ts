import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { defineStyle } from './styles';
import { StyleKind, type Style } from '@feega/motion-core/motion/styles-model';
import { EffectKind } from '@feega/motion-core/motion/effects/registry';
import { FillType } from '@feega/motion-core/motion/fill/model';
import { BlendMode } from '@feega/motion-core/motion/blend';
import { adoptStyle, folderOf, foldered, libraryOf, offeredStyles, styleLabel, syncedDoc } from './style-library';

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
    expect(libraryOf([{ doc: a, scale: 1 }, { doc: b, scale: 1 }])).toEqual({ Brand: RED, Accent: BLUE });
  });

  it('applying a style a frame lacks copies it in and links the element', () => {
    const doc = must(adoptStyle(withText(), ['t'], 'Brand', RED));
    expect(doc.styles?.Brand).toEqual(RED);
    expect(findClip(doc, 't')!.clip.paintStyleRef).toBe('Brand');
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

describe('a text style is the same px in every frame, as in Figma', () => {
  const sized = (width: number, height: number) => must(addClip({ ...newMotionDoc(MotionFormat.Landscape), width, height, freeSize: true }, { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'a' } }, 't'));
  const sizeOf = (doc: MotionDoc) => Number(findClip(doc, 't')!.clip.props.size) * Math.min(doc.width, doc.height);
  const body = { kind: StyleKind.Text, size: 16 / 390, weight: 400 } as const;

  it('the library holds the px the style has in its frame', () => {
    expect(libraryOf([{ doc: must(defineStyle(sized(390, 844), 'Body', body)), scale: 1 }]).Body).toEqual({ kind: StyleKind.Text, sizePx: 16, weight: 400 });
  });

  it('a 16 px style applied in a 342×52 button is 16 px there', () => {
    const library = libraryOf([{ doc: must(defineStyle(sized(390, 844), 'Body', body)), scale: 1 }]);

    expect(sizeOf(must(adoptStyle(sized(342, 52), ['t'], 'Body', library.Body)))).toBeCloseTo(16, 3);
  });

  it('editing the size in the library restyles every frame to the same px', () => {
    const small = must(adoptStyle(sized(342, 52), ['t'], 'Body', { kind: StyleKind.Text, sizePx: 16 }));

    expect(sizeOf(syncedDoc(small, 'Body', { kind: StyleKind.Text, sizePx: 20 })!)).toBeCloseTo(20, 3);
  });
});

describe('a style name with /', () => {
  it('splits into the group it sits in and the name shown in it', () => {
    expect(folderOf('Brand / Primary')).toEqual({ group: 'Brand', leaf: 'Primary' });
    expect(folderOf('Brand/Text/Body')).toEqual({ group: 'Brand / Text', leaf: 'Body' });
    expect(folderOf('Ink')).toEqual({ group: '', leaf: 'Ink' });
  });

  it('keeps a group together, groups in the order they first appear', () => {
    const rows = ['Brand/Primary', 'Ink', 'Brand/Muted', 'Text/Body'].map((name) => [name, null] as const);
    expect(foldered(rows).map(([name]) => name)).toEqual(['Brand/Primary', 'Brand/Muted', 'Ink', 'Text/Body']);
  });
});

describe('a text style on a frame drawn at two doc px per canvas px', () => {
  const LEGACY_SCALE = 0.5;
  const legacy = () => must(addClip({ ...newMotionDoc(MotionFormat.Landscape), width: 780, height: 1688, freeSize: true }, { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'a' } }, 't'));
  const canvasPxOf = (doc: MotionDoc) => Number(findClip(doc, 't')!.clip.props.size) * Math.min(doc.width, doc.height) * LEGACY_SCALE;
  const body = { kind: StyleKind.Text, sizePx: 16, weight: 400 } as const;

  it('a 16 px style draws 16 canvas px, not 8', () => {
    expect(canvasPxOf(must(adoptStyle(legacy(), ['t'], 'Body', body, LEGACY_SCALE)))).toBeCloseTo(16, 3);
  });

  it('editing it keeps it in canvas px', () => {
    const using = must(adoptStyle(legacy(), ['t'], 'Body', body, LEGACY_SCALE));

    expect(canvasPxOf(syncedDoc(using, 'Body', { ...body, sizePx: 20 }, LEGACY_SCALE)!)).toBeCloseTo(20, 3);
  });

  it('the library reads the canvas px the style draws at', () => {
    const using = must(adoptStyle(legacy(), ['t'], 'Body', body, LEGACY_SCALE));

    expect(libraryOf([{ doc: using, scale: LEGACY_SCALE }]).Body).toEqual(body);
  });

  it('the offered style is sized for this frame', () => {
    const offered = offeredStyles(legacy(), 'Text', { Body: body }, LEGACY_SCALE).find((o) => o.name === 'Body');

    expect(offered?.style).toMatchObject({ size: 16 / (780 * LEGACY_SCALE) });
  });
});
