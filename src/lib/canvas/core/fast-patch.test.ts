import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM } from '@feega/motion-core/motion/layout/model';
import { Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { moveBy } from '$lib/motion/space';
import { EditMode } from '$lib/motion/edit-mode';
import { estimatedText } from '@feega/motion-core/motion/layout/text-extent';
import { editedClipId, fastPatch, relinked, reloaded } from './fast-patch';

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

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });

  it('an unhidden last layer is drawn on top as the full build does', () => {
    const before = edit(built(['a', 'b']), 'b', hidden);
    const after = edit(before, 'b', shownAgain);

    expect(fastPatch(drawn(before), before, after, estimatedText, LOOK)).toEqual(drawn(after));
  });
});

const MANY = 80;

const DIGITS = 6;

const rounded = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'number' ? Number(v.toFixed(DIGITS)) : v)));

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
