import { describe, expect, it, vi } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { precompose } from '@feega/motion-core/motion/precomp';
import { addClip } from '@feega/motion-core/motion/timeline';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM } from '@feega/motion-core/motion/layout/model';
import { Direction, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { moveBy } from '$lib/motion/space';
import { EditMode } from '$lib/motion/edit-mode';
import { estimatedText } from '@feega/motion-core/motion/layout/text-extent';
import { editedClipId, editKindOf, fastPatch, laidIncrementally, relinked, reloaded } from './fast-patch';

const SHAPE = { shape: 'rect', x: 0.5, y: 0.5, width: 0.3, height: 0.3, fills: [{ type: 'solid', color: '#ff6a3d' }] };

function built(ids: string[]): MotionDoc {
  return ids.reduce((d, id) => {
    const next = addClip(d, { component: 'Shape', from: 0, durationInFrames: 30, props: SHAPE }, id);
    if (!next.ok) {
      throw new Error(next.error);
    }
    return next.doc;
  }, { ...newMotionDoc(MotionFormat.Square), durationInFrames: 30 } as MotionDoc);
}

const edit = (doc: MotionDoc, id: string, change: (c: MotionClip) => MotionClip): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => (t.clips.some((c) => c.id === id) ? { ...t, clips: t.clips.map((c) => (c.id === id ? change(c) : c)) } : t)) });

const drawn = (doc: MotionDoc) => drawFrame(prepare(doc, FEEGA_TOKENS), 0);

const faded = (opacity: number) => (c: MotionClip) => ({ ...c, transform: { ...c.transform, opacity } });

const hidden = (c: MotionClip) => ({ ...c, hidden: true });

const nested = () => edit(built(['card', 'dot']), 'dot', (c) => ({ ...c, parent: 'card' }));

const SMALL = { width: 0.05, height: 0.05 };

const stack = (sizing: Sizing) => ['a', 'b', 'c'].reduce((d, id) => edit(d, id, (c) => ({ ...c, parent: 'card', props: { ...c.props, ...SMALL } })), edit(built(['card', 'a', 'b', 'c']), 'card', (c) => ({ ...c, autoLayout: { ...DEFAULT_AUTO_LAYOUT, gap: 8 }, layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: sizing } })));

describe('fastPatch draws a simple edit without rebuilding the frame', () => {
  it('a new opacity gives the list the full build would give', () => {
    const before = built(['a', 'b']);
    const after = edit(before, 'a', faded(0.4));

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });

  it('fading a parent fades its children as the full build does', () => {
    const before = nested();
    const after = edit(before, 'card', faded(0.5));

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });

  it('fading a layer already drawn as one group fades the group as the full build does', () => {
    const before = edit(built(['a']), 'a', (c) => ({ ...faded(0.8)(c), props: { ...c.props, fills: [{ type: 'solid', color: '#ff6a3d' }, { type: 'solid', color: '#0000ff80' }] } }));
    const after = edit(before, 'a', faded(0.4));

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });

  it('hiding a layer drops its items as the full build does', () => {
    const before = nested();
    const after = edit(before, 'dot', hidden);

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });

  it('hiding a layer in a fixed auto layout slides its siblings as the full build does', () => {
    const before = stack(Sizing.Fixed);
    const after = edit(before, 'a', hidden);

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });

  it('leaves to the full build a hide that shrinks a hugging auto layout parent', () => {
    const before = stack(Sizing.Hug);
    const after = edit(before, 'a', hidden);

    expect(fastPatch(drawn(before), before, after, estimatedText)).toBeNull();
  });

  it('leaves to the full build a hidden parent, whose children go with it', () => {
    const before = nested();
    const after = edit(before, 'card', hidden);

    expect(fastPatch(drawn(before), before, after, estimatedText)).toBeNull();
  });

  it('leaves to the full build an edit that touches two layers', () => {
    const before = built(['a', 'b']);
    const after = edit(edit(before, 'a', faded(0.4)), 'b', faded(0.4));

    expect(fastPatch(drawn(before), before, after, estimatedText)).toBeNull();
  });

  it('leaves to the full build a fade from nothing, which no ratio can scale', () => {
    const before = edit(built(['a']), 'a', faded(0));
    const after = edit(before, 'a', faded(1));

    expect(fastPatch(drawn(before), before, after, estimatedText)).toBeNull();
  });

  const moved = (doc: MotionDoc, id: string) => {
    const r = moveBy(doc, [id], 0, [12, -7], EditMode.Design);
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.doc;
  };

  it('a nudge shifts the layer as the full build does', () => {
    const before = built(['a', 'b']);
    const after = moved(before, 'a');

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });

  it('a nudged parent carries its children as the full build does', () => {
    const before = nested();
    const after = moved(before, 'card');

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });

  it('a nudge inside an auto layout parent shifts the layer as the full build does', () => {
    const before = stack(Sizing.Fixed);
    const after = moved(before, 'b');

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });

  it('a nudged layer inside a clipping frame keeps the frame cut, as the full build does', () => {
    const before = edit(stack(Sizing.Fixed), 'card', (c) => ({ ...c, clipContent: true }));
    const after = moved(before, 'b');

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });

  it('a nudged clipping frame carries its children as the full build does', () => {
    const before = edit(stack(Sizing.Fixed), 'card', (c) => ({ ...c, clipContent: true }));
    const after = moved(before, 'card');

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });

  it('a nudged layer drawn as one group shifts what the group holds, as the full build does', () => {
    const before = edit(built(['a']), 'a', (c) => ({ ...faded(0.8)(c), props: { ...c.props, fills: [{ type: 'solid', color: '#ff6a3d' }, { type: 'solid', color: '#0000ff80' }] } }));
    const after = moved(before, 'a');

    expect(fastPatch(drawn(before), before, after, estimatedText)).toEqual(drawn(after));
  });
});

const DIGITS = 6;

const rounded = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'number' ? Number(v.toFixed(DIGITS)) : v)));

const LOOK = { tokens: FEEGA_TOKENS, assets: {}, frame: 0 };

const restyled = (props: Record<string, unknown>) => (c: MotionClip) => ({ ...c, props: { ...c.props, ...props } });

describe('fastPatch redraws one restyled layer without rebuilding the frame', () => {
  it('a resized layer gives the list the full build would give', () => {
    const before = built(['a', 'b']);
    const after = edit(before, 'a', restyled({ width: 0.42 }));

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });

  it('a recoloured child gives the list the full build would give', () => {
    const before = nested();
    const after = edit(before, 'dot', restyled({ fills: [{ type: 'solid', color: '#2050ff' }] }));

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });

  it('a resized layer inside a hugging auto layout parent reflows its siblings as the full build does', () => {
    const before = stack(Sizing.Hug);
    const after = edit(before, 'a', restyled({ width: 0.2 }));

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });

  it('a resized layer inside a fixed auto layout parent reflows its siblings as the full build does', () => {
    const before = stack(Sizing.Fixed);
    const after = edit(before, 'b', restyled({ height: 0.2 }));

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });

  it('a hidden layer inside a hugging auto layout parent closes the gap as the full build does', () => {
    const before = stack(Sizing.Hug);
    const after = edit(before, 'a', hidden);

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });

  it('a resize that also moves the children by their constraints redraws them as the full build does', () => {
    const before = nested();
    const after = edit(edit(before, 'card', restyled({ width: 0.5 })), 'dot', restyled({ x: 0.6 }));

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });

  it('a resized layer with children redraws them as the full build does', () => {
    const before = nested();
    const after = edit(before, 'card', restyled({ width: 0.5 }));

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });
});

const shownAgain = (c: MotionClip) => ({ ...c, hidden: false });

describe('fastPatch shows a hidden layer without rebuilding the frame', () => {
  it('an unhidden layer is drawn where the full build draws it', () => {
    const before = edit(built(['a', 'b', 'c']), 'b', hidden);
    const after = edit(before, 'b', shownAgain);

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });

  it('an unhidden layer inside a hugging auto layout parent reopens the gap as the full build does', () => {
    const before = edit(stack(Sizing.Hug), 'b', hidden);
    const after = edit(before, 'b', shownAgain);

    expect(rounded(fastPatch(drawn(before), before, after, estimatedText, LOOK))).toEqual(rounded(drawn(after)));
  });

  it('an unhidden last layer is drawn on top as the full build does', () => {
    const before = edit(built(['a', 'b']), 'b', hidden);
    const after = edit(before, 'b', shownAgain);

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });
});

const MANY = 80;


const tallStack = () => {
  const ids = Array.from({ length: MANY }, (_, i) => `k${i}`);
  return ids.reduce((d, id) => edit(d, id, (c) => ({ ...c, parent: 'card', props: { ...c.props, width: 0.01, height: 0.01 } })), edit(built(['card', ...ids]), 'card', (c) => ({ ...c, autoLayout: { ...DEFAULT_AUTO_LAYOUT, gap: 1 }, layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Hug } })));
};

describe('fastPatch keeps a main-thread redraw within a frame', () => {
  it('slides the siblings a resize pushes along instead of redrawing them, as the full build draws them', () => {
    const before = tallStack();
    const after = edit(before, 'k0', restyled({ width: 0.02 }));

    expect(rounded(fastPatch(drawn(before), before, after, estimatedText, LOOK))).toEqual(rounded(drawn(after)));
  });
});

describe('editedClipId', () => {
  it('names the one clip an edit changed, so a slow edit of one layer does not slow the patches of another', () => {
    const before = built(['a', 'b']);

    expect(editedClipId(before, edit(before, 'b', hidden))).toBe('b');
    expect(editedClipId(before, edit(edit(before, 'a', hidden), 'b', hidden))).toBeNull();
  });
});

describe('relinked', () => {
  it('lets an edit made on a reloaded copy of the shown doc patch like one made on the doc itself', () => {
    const before = built(['a', 'b']);
    const reloaded = JSON.parse(JSON.stringify(before)) as MotionDoc;
    const after = edit(reloaded, 'a', restyled({ width: 0.42 }));

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toBeNull();
    expect(fastPatch(drawn(before), before, relinked(before, after), estimatedText, LOOK)).toEqual(drawn(after));
  });
});

describe('reloaded', () => {
  it('tells a reloaded copy of a doc from an edit of the doc itself', () => {
    const before = built(['a', 'b']);

    expect(reloaded(before, edit(before, 'a', hidden))).toBe(false);
    expect(reloaded(before, JSON.parse(JSON.stringify(before)) as MotionDoc)).toBe(true);
  });
});



describe('laidIncrementally on a big frame', () => {
  it('finds the clips an edit removed without scanning every clip once per clip', () => {
    const before = tallStack();
    const after = edit(before, 'k0', restyled({ width: 0.02 }));
    laidIncrementally(before, before, estimatedText);
    const some = vi.spyOn(Array.prototype, 'some');

    laidIncrementally(before, after, estimatedText);

    const calls = some.mock.calls.length;
    some.mockRestore();
    expect(calls).toBeLessThan(MANY);
  });
});

describe('editKindOf', () => {
  it('names the kind of an edit, so a slow hide and a fast show of one layer keep separate budgets', () => {
    const before = built(['a', 'b']);
    const gone = edit(before, 'b', hidden);

    expect(editKindOf(before, gone)).not.toEqual(editKindOf(gone, before));
    expect(editKindOf(before, edit(edit(before, 'a', hidden), 'b', hidden))).toBe('many');
  });
});

describe('hiding a big section', () => {
  it('removes the hidden subtree in one pass instead of splicing each hidden layer out', () => {
    const kids = Array.from({ length: MANY }, (_, i) => `k${i}`);
    const doc = [['section', 'page'], ['after', 'page'], ...kids.map((k) => [k, 'section'])].reduce((d, [id, parent]) => edit(d, id, (c) => ({ ...c, parent, props: { ...c.props, ...SMALL } })), built(['page', 'section', 'after', ...kids]));
    const laid = edit(edit(doc, 'page', (c) => ({ ...c, autoLayout: { ...DEFAULT_AUTO_LAYOUT, gap: 4 } })), 'section', (c) => ({ ...c, autoLayout: { ...DEFAULT_AUTO_LAYOUT, gap: 4 } }));
    const list = drawn(laid);
    const after = edit(laid, 'section', hidden);
    fastPatch(list, laid, laid, estimatedText, LOOK);
    const slice = vi.spyOn(Array.prototype, 'slice');

    const patched = fastPatch(list, laid, after, estimatedText, LOOK);

    const calls = slice.mock.calls.length;
    slice.mockRestore();
    expect(rounded(patched)).toEqual(rounded(drawn(after)));
    expect(calls).toBeLessThan(MANY);
  });

  it('slides the layers after a hidden section in one pass', () => {
    const later = Array.from({ length: MANY }, (_, i) => `n${i}`);
    const doc = [['section', 'page'], ['inside', 'section'], ...later.map((k) => [k, 'page'])].reduce((d, [id, parent]) => edit(d, id, (c) => ({ ...c, parent, props: { ...c.props, ...SMALL } })), built(['page', 'section', 'inside', ...later]));
    const laid = edit(edit(doc, 'page', (c) => ({ ...c, autoLayout: { ...DEFAULT_AUTO_LAYOUT, direction: Direction.Vertical, gap: 1 } })), 'section', (c) => ({ ...c, autoLayout: { ...DEFAULT_AUTO_LAYOUT, gap: 4 } }));
    const list = drawn(laid);
    const after = edit(laid, 'section', hidden);
    fastPatch(list, laid, laid, estimatedText, LOOK);
    const slice = vi.spyOn(Array.prototype, 'slice');

    const patched = fastPatch(list, laid, after, estimatedText, LOOK);

    const calls = slice.mock.calls.length;
    slice.mockRestore();
    expect(rounded(patched)).toEqual(rounded(drawn(after)));
    expect(calls).toBeLessThan(MANY);
  });
  it('splices every redrawn layer back in one walk of the list', () => {
    const shells = Array.from({ length: 20 }, (_, i) => `s${i}`);
    const still = Array.from({ length: MANY }, (_, i) => `n${i}`);
    const parents = [...shells.map((s, i) => [s, i ? shells[i - 1] : 'page']), ['section', shells[shells.length - 1]], ...still.map((k) => [k, 'page'])];
    const doc = parents.reduce((d, [id, parent]) => edit(d, id, (c) => ({ ...c, parent, props: { ...c.props, ...SMALL } })), built(['page', ...shells, 'section', ...still]));
    const laid = [...shells].reduce((d, id) => edit(d, id, (c) => ({ ...c, clipContent: true, autoLayout: { ...DEFAULT_AUTO_LAYOUT, gap: 4 }, layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Hug } })), doc);
    const list = drawn(laid);
    const after = edit(laid, 'section', hidden);
    fastPatch(list, laid, laid, estimatedText, LOOK);
    const scan = vi.spyOn(String.prototype, 'startsWith');

    const patched = fastPatch(list, laid, after, estimatedText, LOOK);

    const calls = scan.mock.calls.length;
    scan.mockRestore();
    expect(rounded(patched)).toEqual(rounded(drawn(after)));
    expect(calls).toBeLessThan(8 * MANY);
  });

  it('puts every unhidden layer back in one walk of the list', () => {
    const shells = Array.from({ length: 20 }, (_, i) => `s${i}`);
    const still = Array.from({ length: MANY }, (_, i) => `n${i}`);
    const kids = Array.from({ length: 20 }, (_, i) => `k${i}`);
    const parents = [...shells.map((s, i) => [s, i ? shells[i - 1] : 'page']), ['section', shells[shells.length - 1]], ...still.map((k) => [k, 'page']), ...kids.map((k) => [k, 'section'])];
    const doc = parents.reduce((d, [id, parent]) => edit(d, id, (c) => ({ ...c, parent, props: { ...c.props, ...SMALL } })), built(['page', ...shells, 'section', ...still, ...kids]));
    const laid = [...shells].reduce((d, id) => edit(d, id, (c) => ({ ...c, clipContent: true, autoLayout: { ...DEFAULT_AUTO_LAYOUT, gap: 4 }, layoutItem: { ...DEFAULT_LAYOUT_ITEM, width: Sizing.Hug } })), doc);
    const shut = edit(laid, 'section', hidden);
    const list = drawn(shut);
    fastPatch(list, shut, shut, estimatedText, LOOK);
    const scan = vi.spyOn(String.prototype, 'startsWith');

    const patched = fastPatch(list, shut, laid, estimatedText, LOOK);

    const calls = scan.mock.calls.length;
    scan.mockRestore();
    expect(rounded(patched)).toEqual(rounded(drawn(laid)));
    expect(calls).toBeLessThan(30 * MANY);
  });
});

describe('editing inside a component', () => {
  const withComponent = (): MotionDoc => {
    const r = precompose(built(['a', 'inner', 'b']), ['inner'], { comp: 'cmp', clip: 'host' }, 'Card');
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.doc;
  };
  const recoloured = (doc: MotionDoc): MotionDoc => ({ ...doc, comps: Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: comp.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, props: { ...c.props, fills: [{ type: 'solid', color: '#0000ff' }] } })) })) }])) });

  it('redraws the instance of the edited component as the full build does', () => {
    const before = withComponent();
    const after = recoloured(before);

    const patched = fastPatch(drawn(before), before, after, estimatedText, LOOK);

    expect(patched).not.toBeNull();
    expect(rounded(patched)).toEqual(rounded(drawn(after)));
  });

  it('a nudged frame carries the component instance inside it as the full build does', () => {
    const framed = edit(withComponent(), 'host', (c) => ({ ...c, parent: 'a' }));
    const after = edit(framed, 'a', (c) => ({ ...c, transform: { ...c.transform, x: 0.1, y: -0.05 } }));

    const patched = fastPatch(drawn(framed), framed, after, estimatedText);

    expect(patched).not.toBeNull();
    expect(rounded(patched)).toEqual(rounded(drawn(after)));
  });
});

const HUGE = 2000;

const PASSES = ['some', 'every', 'find', 'findIndex', 'indexOf', 'includes', 'filter', 'map', 'flatMap', 'forEach', 'reduce'] as const;

function fullPasses(run: () => void): number {
  let passes = 0;
  const spies = PASSES.map((name) => {
    const original = Array.prototype[name] as (...args: unknown[]) => unknown;
    return vi.spyOn(Array.prototype, name).mockImplementation(function (this: unknown[], ...args: unknown[]) {
      passes += this.length >= HUGE ? 1 : 0;
      return original.apply(this, args);
    } as never);
  });
  try {
    run();
  } finally {
    spies.forEach((spy) => spy.mockRestore());
  }
  return passes;
}

const wide = (parent: string | null = null): MotionDoc => {
  const doc = built(['root']);
  const template = doc.tracks.flatMap((t) => t.clips)[0];
  const clips = Array.from({ length: HUGE }, (_, i) => ({ ...template, id: `w${i}`, parent: parent && `w${i}` !== parent ? parent : null }));
  return { ...doc, tracks: [{ ...doc.tracks.find((t) => t.clips.length)!, clips }] };
};

const touched = (doc: MotionDoc, count: number, change: (c: MotionClip) => MotionClip): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c, i) => (i < count ? change(c) : c)) })) });

describe('one edit on a frame of 2,000 layers', () => {
  it('pairs the clips of a restyle of many layers without searching the list once per layer', () => {
    const before = wide();
    const after = touched(before, 100, restyled({ width: 0.02 }));

    const list = drawn(before);

    const passes = fullPasses(() => fastPatch(list, before, after, estimatedText));

    expect(passes).toBeLessThan(20);
  });

  it('compares the two docs of one edit once, however many times the patch asks which clip changed', () => {
    const before = wide();
    const after = touched(before, 1, faded(0.5));
    const list = drawn(before);

    const passes = fullPasses(() => {
      editedClipId(before, after);
      editKindOf(before, after);
      fastPatch(list, before, after, estimatedText);
    });

    expect(passes).toBeLessThanOrEqual(4);
  });

  it('lists the layers a hide redraws without searching the list once per layer', () => {
    const before = wide('w0');
    const after = touched(before, 1, hidden);
    const list = drawn(before);

    const passes = fullPasses(() => fastPatch(list, before, after, estimatedText, LOOK));

    expect(passes).toBeLessThan(60);
  });
});
