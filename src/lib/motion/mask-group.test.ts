import { describe, expect, it } from 'vitest';
import { TrackKind } from './components';
import { Ease } from './design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { Matte } from './mask';
import { hiddenMattes, mattePairs } from './matte';
import { joinMask, leaveMask, maskMembers, releaseMask, releaseMasks, useAsMask } from './mask-group';
import { withoutHidden, setClipFlags } from './organize';
import { addClip, addTrack, setKeyframes, setTrackMatte, type OpResult } from './timeline';
import { ShapeKind } from './shape/schema';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function stack(): MotionDoc {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: ShapeKind.Ellipse, width: 0.3, height: 0.3 } }, 'disc'));
  doc = must(addTrack(doc, TrackKind.Visual, 'mid'));
  doc = must(addClip(doc, { component: 'Image', from: 0, durationInFrames: 90, trackId: 'mid', props: { assetId: 'pic' } }, 'photo'));
  doc = must(addTrack(doc, TrackKind.Visual, 'top'));
  return must(addClip(doc, { component: 'Title', from: 0, durationInFrames: 90, trackId: 'top', props: { text: 'GO' } }, 'title'));
}

const order = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips.map((c) => c.id));

describe('use as mask', () => {
  it('the bottom-most selected layer masks the others with its alpha, whatever order they were picked in', () => {
    const doc = stack();
    expect(order(doc).slice(0, 3)).toEqual(['title', 'photo', 'disc']);

    const masked = must(useAsMask(doc, ['photo', 'disc', 'title']));

    expect(mattePairs(masked)).toEqual([
      { target: 'title', source: 'disc', matte: Matte.Alpha },
      { target: 'photo', source: 'disc', matte: Matte.Alpha }
    ]);
    expect(hiddenMattes(masked)).toEqual(new Set(['disc']));
    expect(maskMembers(masked)).toEqual(new Map([['disc', ['title', 'photo']]]));
  });

  it('needs the mask and at least one layer above it', () => {
    expect(useAsMask(stack(), ['disc'])).toMatchObject({ ok: false });
    expect(useAsMask(stack(), ['disc', 'ghost'])).toMatchObject({ ok: false });
  });

  it('a new layer joins an existing mask, but a mask is never masked itself', () => {
    const masked = must(useAsMask(stack(), ['photo', 'disc']));

    expect(maskMembers(must(useAsMask(masked, ['title', 'disc']))).get('disc')).toEqual(['title', 'photo']);
    expect(useAsMask(must(useAsMask(stack(), ['title', 'photo'])), ['photo', 'disc'])).toMatchObject({ ok: false });
  });

  it('a keyframed mask stays a mask: its keyframes move what it reveals', () => {
    const keyed = must(setKeyframes(stack(), 'disc', 'scale', [{ frame: 0, value: 0.2, ease: Ease.Linear }, { frame: 60, value: 3, ease: Ease.Linear }]));
    const masked = must(useAsMask(keyed, ['photo', 'disc']));

    expect(findClip(masked, 'disc')?.clip.keyframes.scale).toHaveLength(2);
    expect(mattePairs(masked)).toEqual([{ target: 'photo', source: 'disc', matte: Matte.Alpha }]);
  });
});

describe('turning a mask off and removing it', () => {
  const masked = () => must(useAsMask(stack(), ['title', 'photo', 'disc']));

  it('a hidden mask masks nothing, and its layers draw whole', () => {
    const off = must(setClipFlags(masked(), 'disc', { hidden: true }));

    expect(mattePairs(withoutHidden(off))).toEqual([]);
    expect(maskMembers(off).get('disc')).toEqual(['title', 'photo']);
  });

  it('remove mask frees every layer and the shape paints again', () => {
    const freed = must(releaseMask(masked(), 'disc'));

    expect(mattePairs(freed)).toEqual([]);
    expect(hiddenMattes(freed).size).toBe(0);
    expect(findClip(freed, 'photo')?.clip).toMatchObject({ matte: Matte.None, matteFrom: null });
    expect(releaseMask(freed, 'disc')).toMatchObject({ ok: false });
  });

  it('remove mask on a selection frees the masks it holds or touches, and refuses one that touches none', () => {
    expect(mattePairs(must(releaseMasks(masked(), ['photo'])))).toEqual([]);
    expect(mattePairs(must(releaseMasks(masked(), ['disc'])))).toEqual([]);
    expect(releaseMasks(stack(), ['photo'])).toMatchObject({ ok: false });
  });

  it('turning the matte off by hand leaves the mask too', () => {
    const doc = must(setTrackMatte(masked(), 'photo', Matte.None));

    expect(maskMembers(doc).get('disc')).toEqual(['title']);
  });
});

describe('joining and leaving a mask one layer at a time', () => {
  it('a layer above the mask joins it; one below cannot', () => {
    const doc = must(useAsMask(stack(), ['photo', 'disc']));

    expect(maskMembers(must(joinMask(doc, 'title', 'disc'))).get('disc')).toEqual(['title', 'photo']);
    expect(joinMask(doc, 'disc', 'photo')).toMatchObject({ ok: false });
  });

  it('leaving drops the last member, and with it the mask; leaving twice is harmless', () => {
    const doc = must(leaveMask(must(useAsMask(stack(), ['photo', 'disc'])), 'photo'));

    expect(maskMembers(doc).size).toBe(0);
    expect(leaveMask(doc, 'photo')).toMatchObject({ ok: true });
  });
});
