import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, parseMotionDoc, type MotionClip, type MotionDoc } from '../doc';
import { Align, Direction, Justify, Sizing } from './auto-layout';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM, type AutoLayout } from './model';
import { withAutoLayout } from './resolve';
import { TrackKind } from '../components';
import { textBaseline, textExtent } from './text-extent';

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

  it('baseline alignment sits a text on the bottom of a box', () => {
    const text = newClip({ id: 't', from: 0, durationInFrames: 30, component: 'Kicker', props: { text: 'HI', size: 0.05, leading: 1, tracking: 0, x: 0, y: 0, width: 0.2, height: 0.1 }, parent: 'c' });
    const doc = docOf([text, shape('a', { x: 0, y: 0, width: 0.1, height: 0.2 }, { parent: 'c' }), shape('c', { x: 0.5, y: 0.5, width: 1, height: 1 }, { autoLayout: flow({ align: Align.Baseline }) })]);
    const out = withAutoLayout(doc);
    const top = (propsOf(out, 't').y as number) - 0.05;
    expect(top * H + textBaseline('Kicker', text.props, 1000)).toBeCloseTo(200, 5);
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

  it('a component instance takes the size of what it shows and moves by its offset, not by a box it has not got', () => {
    const button = shape('btn', { x: 0.6, y: 0.6, width: 0.2, height: 0.1 });
    const host = newClip({ id: 'i', from: 0, durationInFrames: 30, component: 'Precomp', props: { comp: 'k' }, parent: 'c' });
    const doc = {
      ...docOf([shape('a', { x: 0, y: 0, width: 0.1, height: 0.1 }, { parent: 'c' }), host, shape('c', { x: 0.5, y: 0.5, width: 1, height: 1 }, { autoLayout: flow({ gap: 10 }) })]),
      comps: { k: { name: 'Button', durationInFrames: 30, tracks: [{ id: 'v1', kind: TrackKind.Visual, name: '', clips: [button] }] } }
    } as MotionDoc;
    const out = withAutoLayout(doc);
    const laid = out.tracks.flatMap((t) => t.clips).find((c) => c.id === 'i')!;
    expect(laid.props).toEqual({ comp: 'k' });
    expect(laid.transform).toMatchObject({ x: -0.39, y: -0.55 });
  });
});

describe('strokes in layout', () => {
  const stroked = (align: string, over: Partial<AutoLayout> = {}, extra: object = {}) =>
    docOf([
      shape('a', { x: 0, y: 0, width: 0.1, height: 0.1 }, { parent: 'c' }),
      shape('c', { x: 0.5, y: 0.5, width: 0.5, height: 0.5, shape: 'rect', strokes: [{ paint: { type: 'solid', color: '#000' }, width: 0.01, align, ...extra }] } as never, { autoLayout: flow({ strokesIncluded: true, ...over }) })
    ]);

  it('an inside stroke shrinks the content box of its container', () => {
    expect(propsOf(withAutoLayout(stroked('inside')), 'a')).toMatchObject({ x: 0.31, y: 0.31 });
  });

  it('a centre or outside stroke leaves the content box alone', () => {
    expect(propsOf(withAutoLayout(stroked('center')), 'a')).toMatchObject({ x: 0.3, y: 0.3 });
    expect(propsOf(withAutoLayout(stroked('outside')), 'a')).toMatchObject({ x: 0.3, y: 0.3 });
  });

  it('a hidden stroke does not count', () => {
    expect(propsOf(withAutoLayout(stroked('inside', {}, { visible: false })), 'a')).toMatchObject({ x: 0.3, y: 0.3 });
  });

  it('a document saved before strokesIncluded existed lays out as it always did', () => {
    const { strokesIncluded: _gone, ...legacy } = flow();
    const verdict = parseMotionDoc(
      docOf([
        shape('a', { x: 0, y: 0, width: 0.1, height: 0.1 }, { parent: 'c' }),
        shape('c', { x: 0.5, y: 0.5, width: 0.5, height: 0.5, shape: 'rect', strokes: [{ paint: { type: 'solid', color: '#000' }, width: 0.01, align: 'inside' }] } as never, { autoLayout: legacy as AutoLayout })
      ])
    );

    expect(verdict.ok && propsOf(withAutoLayout(verdict.doc), 'a')).toMatchObject({ x: 0.3, y: 0.3 });
  });

  it('strokesIncluded false ignores the stroke', () => {
    expect(propsOf(withAutoLayout(stroked('inside', { strokesIncluded: false })), 'a')).toMatchObject({ x: 0.3, y: 0.3 });
  });

  it('the stroke adds to the padding', () => {
    expect(propsOf(withAutoLayout(stroked('inside', { padding: { top: 10, right: 0, bottom: 0, left: 10 } })), 'a')).toMatchObject({ x: 0.32, y: 0.32 });
  });

  it('per-side widths of a rectangle count side by side', () => {
    expect(propsOf(withAutoLayout(stroked('inside', {}, { sides: [0.02, 0, 0, 0.01] })), 'a')).toMatchObject({ x: 0.31, y: 0.32 });
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

describe('an instance in a stack', () => {
  it('takes the size its component hugs to, not the size the component was drawn at', () => {
    const hugging = { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Hug, height: Sizing.Hug };
    const root = shape('root', { x: 0.05, y: 0.05, width: 0.1, height: 0.1 }, { autoLayout: flow({ direction: Direction.Vertical }), layoutItem: hugging });
    const dot = shape('dot', { x: 0.025, y: 0.01, width: 0.05, height: 0.02 }, { parent: 'root' });
    const column = shape('col', { x: 0.5, y: 0.5, width: 0.2, height: 0.2 }, { autoLayout: flow({ direction: Direction.Vertical }), layoutItem: hugging });
    const instance = newClip({ id: 'inst', from: 0, durationInFrames: 30, component: 'Precomp', parent: 'col', props: { comp: 'c' } });
    const doc = docOf([column, instance]);
    const withComp = { ...doc, comps: { c: { name: 'C', durationInFrames: 30, tracks: [{ id: 'v', kind: TrackKind.Visual, name: '', clips: [root, dot] }] } } } as MotionDoc;

    expect(propsOf(withAutoLayout(withComp), 'col').height * H).toBeCloseTo(20);
  });
});

describe('text that fills its column', () => {
  it('wraps at the width the column gives it, not at the width it was drawn with', () => {
    const text = { text: 'Every step of month-end in one place your auditors can read.', size: 0.044, leading: 1.1 };
    const column = shape('col', { x: 0.25, y: 0.1, width: 0.4, height: 0.05 }, { autoLayout: flow({ direction: Direction.Vertical }), layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Fixed, height: Sizing.Hug } });
    const title = newClip({ id: 'title', from: 0, durationInFrames: 30, component: 'Text', parent: 'col', props: { ...text, x: 0.05, y: 0.05, width: 0.1, height: 0.05 }, layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Fill, height: Sizing.Hug } });

    const laid = withAutoLayout(docOf([column, title]));

    const wrapped = textExtent('Text', text, W, 400).height;
    expect(propsOf(laid, 'title').height * H).toBeCloseTo(wrapped);
    expect(propsOf(laid, 'col').height * H).toBeCloseTo(wrapped);
  });
});
