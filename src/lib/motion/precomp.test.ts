import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { MotionFormat, clipsOf, findClip, newMotionDoc, parseMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { addClip, setKeyframes, setProps, type OpResult } from './timeline';
import { setParent } from './parent-ops';
import { addAdjustment, flattenComps, mergeView, precompose, viewOf } from './precomp';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = (() => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 300 }, 'bg'));
  doc = must(addClip(doc, { component: 'Title', from: 30, durationInFrames: 60 }, 'title'));
  doc = must(addClip(doc, { component: 'Caption', from: 60, durationInFrames: 60 }, 'cap'));
  return { ...doc, durationInFrames: 300 };
})();

const precomposed = must(precompose(base, ['title', 'cap'], { comp: 'intro', clip: 'pc' }, 'Intro'));
const placed = (doc: MotionDoc) => clipsOf(flattenComps(doc));
const byId = (doc: MotionDoc, id: string) => placed(doc).find((c) => c.id === id) as MotionClip;

describe('precompose', () => {
  it('moves the chosen clips into a new composition, shifted to start at its first frame', () => {
    const comp = precomposed.comps.intro;

    expect(comp.name).toBe('Intro');
    expect(comp.durationInFrames).toBe(90);
    expect(comp.tracks.flatMap((t) => t.clips.map((c) => [c.id, c.from]))).toEqual([
      ['title', 0],
      ['cap', 30]
    ]);
  });

  it('leaves one precomp clip where the clips were, and the rest untouched', () => {
    const pc = findClip(precomposed, 'pc')!.clip;

    expect([pc.component, pc.from, pc.durationInFrames, pc.props.comp]).toEqual(['Precomp', 30, 90, 'intro']);
    expect(findClip(precomposed, 'title')).toBeNull();
    expect(findClip(precomposed, 'bg')).not.toBeNull();
    expect(parseMotionDoc(precomposed).ok).toBe(true);
  });

  it('a parent left outside the selection is let go, so no link crosses the composition', () => {
    let doc = must(addClip(base, { component: 'Null', from: 0, durationInFrames: 300 }, 'rig'));
    doc = must(setParent(doc, 'title', 'rig'));

    const next = must(precompose(doc, ['title'], { comp: 'c', clip: 'p' }, 'C'));

    expect(next.comps.c.tracks[0].clips[0].parent).toBeNull();
  });

  it('refuses an empty selection', () => {
    expect(precompose(base, [], { comp: 'c', clip: 'p' }, 'C').ok).toBe(false);
  });
});

describe('editing inside a composition', () => {
  it('the view is the composition as a doc: its tracks and its length', () => {
    const view = viewOf(precomposed, ['intro']);

    expect(view.durationInFrames).toBe(90);
    expect(view.tracks.flatMap((t) => t.clips.map((c) => c.id))).toEqual(['title', 'cap']);
  });

  it('an edit made in the view lands in the composition, the main timeline keeps its own', () => {
    const view = viewOf(precomposed, ['intro']);
    const edited = must(setProps(view, 'title', { text: 'Hello' }));

    const root = mergeView(precomposed, ['intro'], edited);

    expect(root.comps.intro.tracks[0].clips[0].props.text).toBe('Hello');
    expect(root.tracks).toEqual(precomposed.tracks);
    expect(root.durationInFrames).toBe(300);
  });

  it('the root path is the doc itself', () => {
    expect(viewOf(precomposed, [])).toBe(precomposed);
    expect(mergeView(precomposed, [], base)).toBe(base);
  });
});

describe('a precomp in the rendered timeline', () => {
  it('its clips play at the precomp time, under ids of their own', () => {
    expect(byId(precomposed, 'pc__0__title').from).toBe(30);
    expect(byId(precomposed, 'pc__0__cap').from).toBe(60);
  });

  it('trim starts the composition later and cuts what falls outside', () => {
    const trimmed = { ...precomposed, tracks: precomposed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'pc' ? { ...c, trimStart: 45, durationInFrames: 45 } : c)) })) };

    const title = byId(trimmed, 'pc__0__title');
    const cap = byId(trimmed, 'pc__0__cap');

    expect([title.from, title.durationInFrames, title.trimStart]).toEqual([30, 15, 45]);
    expect([cap.from, cap.durationInFrames, cap.trimStart]).toEqual([30, 45, 15]);
  });

  it('a keyframe keeps its moment when the start of a clip is cut away', () => {
    let doc = must(setKeyframes(viewOf(precomposed, ['intro']), 'title', 'opacity', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 40, value: 1, ease: Ease.Linear }]));
    doc = mergeView(precomposed, ['intro'], doc);
    doc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'pc' ? { ...c, trimStart: 10, durationInFrames: 80 } : c)) })) };

    expect(byId(doc, 'pc__0__title').keyframes.opacity.map((k) => k.frame)).toEqual([-10, 30]);
  });

  it('a looping precomp repeats the composition until the clip ends', () => {
    let doc = must(setProps(precomposed, 'pc', { loop: true }));
    doc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'pc' ? { ...c, durationInFrames: 200 } : c)) })) };

    const titles = placed(doc).filter((c) => c.id.endsWith('__title')).map((c) => [c.from, c.durationInFrames]);

    expect(titles).toEqual([
      [30, 60],
      [120, 60],
      [210, 20]
    ]);
  });

  it('without loop the composition plays once and holds nothing after its end', () => {
    const doc = { ...precomposed, tracks: precomposed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'pc' ? { ...c, durationInFrames: 200 } : c)) })) };

    expect(placed(doc).filter((c) => c.id.endsWith('__title'))).toHaveLength(1);
  });

  it('held, the composition plays once and its last frame stays until the clip ends', () => {
    let doc = must(setProps(precomposed, 'pc', { hold: true }));
    doc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'pc' ? { ...c, durationInFrames: 200 } : c)) })) };
    const cap = byId(doc, 'pc__0__cap');

    expect([cap.from, cap.durationInFrames, cap.transitionOut.durationInFrames]).toEqual([60, 170, 0]);
    expect(byId(doc, 'pc__0__title').durationInFrames).toBe(60);
  });

  it('the precomp itself becomes the group over exactly its composition tracks', () => {
    const flat = flattenComps(precomposed);
    const group = clipsOf(flat).find((c) => c.id === 'pc')!;

    expect(group.props.span).toBe(precomposed.comps.intro.tracks.length);
    const at = flat.tracks.findIndex((t) => t.clips.some((c) => c.id === 'pc'));
    expect(flat.tracks[at].clips).toHaveLength(1);
    expect(flat.tracks.slice(at + 1, at + 1 + Number(group.props.span)).flatMap((t) => t.clips.map((c) => c.id))).toEqual(['pc__0__title', 'pc__0__cap']);
  });

  it('a precomp inside a precomp plays at the sum of both offsets', () => {
    const outer = must(precompose(precomposed, ['pc'], { comp: 'outer', clip: 'po' }, 'Outer'));

    expect(byId(outer, 'po__0__pc__0__title').from).toBe(30);
  });

  it('a doc without precomps is left as it was', () => {
    expect(flattenComps(base)).toEqual(base);
  });
});

describe('composition references', () => {
  it('refuses a precomp that points at a composition that does not exist', () => {
    const dangling = { ...precomposed, tracks: precomposed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'pc' ? { ...c, props: { comp: 'nope', loop: false } } : c)) })) };

    expect(parseMotionDoc(dangling).ok).toBe(false);
    expect(setProps(precomposed, 'pc', { comp: 'nope' }).ok).toBe(false);
  });

  it('refuses a composition that contains itself', () => {
    const view = viewOf(precomposed, ['intro']);
    const looped = mergeView(precomposed, ['intro'], must(addClip(view, { component: 'Precomp', from: 0, props: { comp: 'intro' } }, 'self')));

    expect(parseMotionDoc(looped)).toMatchObject({ ok: false, error: expect.stringContaining('contains itself') });
  });

  it('adding a precomp of an unknown composition fails at once', () => {
    expect(addClip(base, { component: 'Precomp', from: 0, props: { comp: 'nope' } }, 'x').ok).toBe(false);
  });
});

describe('adjustment layer', () => {
  it('goes on a new top track, so everything else is under it', () => {
    const doc = must(addAdjustment(base, { from: 30, durationInFrames: 60 }, { clip: 'adj', track: 'fx' }));

    expect(doc.tracks[0].id).toBe('fx');
    expect(doc.tracks[0].clips.map((c) => [c.id, c.component])).toEqual([['adj', 'Adjustment']]);
  });
});
