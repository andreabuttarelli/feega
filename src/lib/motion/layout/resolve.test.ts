import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, parseMotionDoc, type MotionClip, type MotionDoc } from '../doc';
import { Direction, Justify, Sizing } from './auto-layout';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM, type AutoLayout } from './model';
import { withAutoLayout } from './resolve';
import { textExtent } from './text-extent';

const W = 1000;
const H = 1000;

function docOf(clips: MotionClip[]): MotionDoc {
  const doc = newMotionDoc(MotionFormat.Square);
  return { ...doc, width: W, height: H, tracks: clips.map((c, i) => ({ id: `t${i}`, kind: doc.tracks[0].kind, name: '', clips: [c] })) };
}

const shape = (id: string, box: { x: number; y: number; width: number; height: number }, over: Partial<MotionClip> = {}) => newClip({ id, from: 0, durationInFrames: 30, component: 'Shape', props: { ...box }, ...over });

const flow = (over: Partial<AutoLayout> = {}): AutoLayout => ({ ...DEFAULT_AUTO_LAYOUT, ...over });

const propsOf = (doc: MotionDoc, id: string) => doc.tracks.flatMap((t) => t.clips).find((c) => c.id === id)!.props;

describe('withAutoLayout', () => {
  it('leaves a doc without containers untouched', () => {
    const doc = docOf([shape('a', { x: 0.5, y: 0.5, width: 0.1, height: 0.1 })]);
    expect(withAutoLayout(doc)).toBe(doc);
  });

  it('lays the children of a container out from its top-left, in frame fractions', () => {
    const doc = docOf([
      shape('a', { x: 0.9, y: 0.9, width: 0.1, height: 0.1 }, { parent: 'c' }),
      shape('b', { x: 0.1, y: 0.1, width: 0.2, height: 0.1 }, { parent: 'c' }),
      shape('c', { x: 0.5, y: 0.5, width: 0.6, height: 0.2 }, { autoLayout: flow({ gap: 50, padding: { top: 10, right: 0, bottom: 0, left: 20 } }) })
    ]);
    const out = withAutoLayout(doc);
    expect(propsOf(out, 'a')).toMatchObject({ x: 0.27, y: 0.46, width: 0.1, height: 0.1 });
    expect(propsOf(out, 'b')).toMatchObject({ x: 0.47, y: 0.46, width: 0.2, height: 0.1 });
  });

  it('follows order, then track order for the children it does not list', () => {
    const doc = docOf([
      shape('a', { x: 0, y: 0, width: 0.1, height: 0.1 }, { parent: 'c' }),
      shape('b', { x: 0, y: 0, width: 0.1, height: 0.1 }, { parent: 'c' }),
      shape('z', { x: 0, y: 0, width: 0.1, height: 0.1 }, { parent: 'c' }),
      shape('c', { x: 0.5, y: 0.5, width: 1, height: 0.1 }, { autoLayout: flow({ order: ['b', 'gone', 'a'] }) })
    ]);
    const out = withAutoLayout(doc);
    expect([propsOf(out, 'b').x, propsOf(out, 'a').x, propsOf(out, 'z').x]).toEqual([0.05, 0.15, 0.25]);
  });

  it('a hugging container takes its children size and keeps its top-left', () => {
    const doc = docOf([
      shape('a', { x: 0, y: 0, width: 0.1, height: 0.05 }, { parent: 'c' }),
      shape('c', { x: 0.5, y: 0.5, width: 0.4, height: 0.4 }, { autoLayout: flow({ padding: { top: 10, right: 10, bottom: 10, left: 10 } }), layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Hug, height: Sizing.Hug } })
    ]);
    expect(propsOf(withAutoLayout(doc), 'c')).toMatchObject({ x: 0.36, y: 0.335, width: 0.12, height: 0.07 });
  });

  it('a hugging text child takes its estimated extent', () => {
    const text = newClip({ id: 't', from: 0, durationInFrames: 30, component: 'Kicker', props: { text: 'HELLO', size: 0.02, leading: 1.2, tracking: 0, x: 0, y: 0, width: 0.5, height: 0.5 }, parent: 'c', layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Hug, height: Sizing.Hug } });
    const doc = docOf([text, shape('c', { x: 0.5, y: 0.5, width: 1, height: 1 }, { autoLayout: flow() })]);
    const extent = textExtent('Kicker', text.props, 1000);
    expect(propsOf(withAutoLayout(doc), 't')).toMatchObject({ width: extent.width / W, height: extent.height / H });
  });

  it('absolute and hidden children keep their own box and take no slot', () => {
    const doc = docOf([
      shape('x', { x: 0.9, y: 0.9, width: 0.1, height: 0.1 }, { parent: 'c', layoutItem: { ...DEFAULT_LAYOUT_ITEM, absolute: true } }),
      shape('a', { x: 0, y: 0, width: 0.1, height: 0.1 }, { parent: 'c' }),
      shape('c', { x: 0.5, y: 0.5, width: 1, height: 0.1 }, { autoLayout: flow({ justify: Justify.Start }) })
    ]);
    const out = withAutoLayout(doc);
    expect(propsOf(out, 'x')).toMatchObject({ x: 0.9, y: 0.9 });
    expect(propsOf(out, 'a').x).toBe(0.05);
  });

  it('nests: an inner container is placed, then lays out its own children', () => {
    const doc = docOf([
      shape('p', { x: 0, y: 0, width: 0.1, height: 0.1 }, { parent: 'i' }),
      shape('q', { x: 0, y: 0, width: 0.1, height: 0.1 }, { parent: 'i' }),
      shape('i', { x: 0, y: 0, width: 0, height: 0 }, { parent: 'c', autoLayout: flow({ direction: Direction.Vertical }), layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Hug, height: Sizing.Hug } }),
      shape('c', { x: 0.5, y: 0.5, width: 1, height: 1 }, { autoLayout: flow({ padding: { top: 100, right: 0, bottom: 0, left: 100 } }) })
    ]);
    const out = withAutoLayout(doc);
    expect(propsOf(out, 'i')).toMatchObject({ x: 0.15, y: 0.2, width: 0.1, height: 0.2 });
    expect(propsOf(out, 'q')).toMatchObject({ x: 0.15, y: 0.25 });
  });

  it('lays out inside a composition at the composition size', () => {
    const inner = docOf([shape('a', { x: 0, y: 0, width: 0.5, height: 0.5 }, { parent: 'c' }), shape('c', { x: 0.5, y: 0.5, width: 1, height: 1 }, { autoLayout: flow() })]);
    const doc = { ...docOf([]), comps: { k: { name: 'k', durationInFrames: 30, frame: { width: 200, height: 100 }, tracks: inner.tracks } } };
    expect(propsOf({ ...doc, tracks: withAutoLayout(doc).comps.k.tracks } as MotionDoc, 'a')).toMatchObject({ x: 0.25, y: 0.25 });
  });
});

describe('the doc model', () => {
  it('an old doc without the fields still parses', () => {
    expect(parseMotionDoc(docOf([shape('a', { x: 0.5, y: 0.5, width: 0.1, height: 0.1 })])).ok).toBe(true);
  });

  it('parses a container and fills in the defaults', () => {
    const verdict = parseMotionDoc(docOf([shape('c', { x: 0.5, y: 0.5, width: 0.1, height: 0.1 }, { autoLayout: { gap: 12 } as AutoLayout })]));
    expect(verdict.ok && verdict.doc.tracks[0].clips[0].autoLayout).toEqual({ ...DEFAULT_AUTO_LAYOUT, gap: 12 });
  });
});
