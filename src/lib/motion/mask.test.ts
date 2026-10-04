import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { DOC_VERSION, MotionFormat, findClip, newMotionDoc, parseMotionDoc, upgradeDoc, type MotionDoc } from './doc';
import { editAt, valueAt } from './inspector';
import { keyLanes } from './timeline-view';
import { ANIMATABLE, Source, baseValue } from './keyframes';
import { MASK_PROPS, MaskKind, Matte, newMask } from './mask';
import { matteMask, matteSource, hiddenMattes } from './matte';
import { addClip, addTrack, setKeyframes, setMask, setTrackMatte, type OpResult } from './timeline';
import { TrackKind } from './components';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 0, durationInFrames: 90, props: { assetId: 'pic' } }, 'img'));
const clipOf = (doc: MotionDoc, id = 'img') => findClip(doc, id)!.clip;

describe('mask schema', () => {
  it('a new clip has no mask and no track matte', () => {
    expect(clipOf(base).mask).toBeNull();
    expect(clipOf(base).matte).toBe(Matte.None);
  });

  it('a mask takes the defaults of every prop it does not name', () => {
    const doc = must(setMask(base, 'img', { kind: MaskKind.Ellipse }));

    expect(clipOf(doc).mask).toMatchObject({ kind: 'ellipse', x: 0.5, y: 0.5, width: 0.5, height: 0.5, rotation: 0, feather: 0, expansion: 0, opacity: 1, invert: false });
  });

  it('a picture or luminance mask needs an asset', () => {
    expect(setMask(base, 'img', { kind: MaskKind.Image }).ok).toBe(false);
    expect(setMask(base, 'img', { kind: MaskKind.Luma, assetId: 'pic' }).ok).toBe(true);
  });

  it('a polygon needs at least three points inside its box', () => {
    expect(setMask(base, 'img', { kind: MaskKind.Polygon, points: [[0, 0], [1, 1]] }).ok).toBe(false);
    expect(setMask(base, 'img', { kind: MaskKind.Polygon, points: [[0, 0], [1, 0], [2, 1]] }).ok).toBe(false);
    expect(setMask(base, 'img', { kind: MaskKind.Polygon, points: [[0, 0], [1, 0], [0.5, 1]] }).ok).toBe(true);
  });

  it('every kind has a usable default', () => {
    for (const kind of Object.values(MaskKind)) {
      expect(setMask(base, 'img', newMask(kind, 'pic')).ok).toBe(true);
    }
  });

  it('a text mask can grow until one letter is wider than the frame, so a word can open onto the next scene', () => {
    const doc = must(setMask(base, 'img', { kind: MaskKind.Text, text: 'CANVAS' }));

    expect(setKeyframes(doc, 'img', 'maskWidth', [{ frame: 0, value: 0.6, ease: Ease.Linear }, { frame: 30, value: 40, ease: Ease.Linear }]).ok).toBe(true);
    expect(setMask(base, 'img', { kind: MaskKind.Text, text: 'CANVAS', width: 40, height: 20 }).ok).toBe(true);
    expect(setKeyframes(doc, 'img', 'maskX', [{ frame: 0, value: 0.5, ease: Ease.Linear }, { frame: 30, value: 9.5, ease: Ease.Linear }]).ok).toBe(true);
  });

  it('a masked doc survives a save and a load', () => {
    const doc = must(setMask(base, 'img', { kind: MaskKind.Text, text: 'SALE', feather: 12 }));
    const parsed = parseMotionDoc(JSON.parse(JSON.stringify(doc)));

    expect(parsed.ok && clipOf(parsed.doc).mask).toEqual(clipOf(doc).mask);
  });
});

describe('version 2 docs', () => {
  const v2 = {
    version: 2,
    fps: 30,
    width: 1080,
    height: 1080,
    durationInFrames: 90,
    tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'c1', from: 0, durationInFrames: 30, trimStart: 0, component: 'Title', props: {}, transitionIn: { kind: 'none', durationInFrames: 0 }, transitionOut: { kind: 'none', durationInFrames: 0 }, transform: {}, keyframes: {} }] }],
    assets: []
  };

  it('upgrade to the current version with no mask and no matte', () => {
    const upgraded = upgradeDoc(v2) as { version: number; tracks: { clips: { mask: unknown; matte: unknown }[] }[] };

    expect(upgraded.version).toBe(DOC_VERSION);
    expect(upgraded.tracks[0].clips[0].mask).toBeNull();
    expect(upgraded.tracks[0].clips[0].matte).toBe('none');
  });
});

describe('animating a mask', () => {
  const masked = must(setMask(base, 'img', { kind: MaskKind.Ellipse, width: 0.2 }));

  it('every visual component animates the mask, audio does not', () => {
    expect(ANIMATABLE.Image.filter((p) => p.source === Source.Mask).map((p) => p.key)).toEqual(Object.keys(MASK_PROPS));
    expect(ANIMATABLE.Audio).toEqual([]);
  });

  it('the base value of a mask prop is the mask field', () => {
    expect(baseValue(clipOf(masked), 'maskWidth')).toBe(0.2);
  });

  it('a mask prop interpolates between its keyframes like any other', () => {
    const keyed = must(setKeyframes(masked, 'img', 'maskWidth', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 60, value: 1.2, ease: Ease.Linear }]));

    expect(valueAt(clipOf(keyed), 'maskWidth', 30, (c) => c)).toBeCloseTo(0.6, 6);
  });

  it('a clip without a mask cannot key one', () => {
    const r = setKeyframes(base, 'img', 'maskX', [{ frame: 0, value: 0, ease: Ease.Linear }]);

    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/mask/);
  });

  it('removing the mask takes its keyframes with it, and leaves the others', () => {
    const keyed = must(setKeyframes(must(setKeyframes(masked, 'img', 'maskX', [{ frame: 0, value: 0.2, ease: Ease.Linear }])), 'img', 'rotateZ', [{ frame: 0, value: 10, ease: Ease.Linear }]));
    const removed = must(setMask(keyed, 'img', null));

    expect(Object.keys(clipOf(removed).keyframes)).toEqual(['rotateZ']);
  });
});

describe('track matte', () => {
  const stacked = must(addClip(must(addTrack(base, TrackKind.Visual, 'top')), { component: 'Title', from: 10, durationInFrames: 60, trackId: 'top', props: { text: 'GO', x: 0.5, y: 0.5, width: 0.6, height: 0.4, rotation: 5 } }, 'title'));

  it('the matte is the clip directly above, on the track above, overlapping in time', () => {
    expect(matteSource(stacked, 'img')?.id).toBe('title');
    expect(matteSource(stacked, 'title')).toBeNull();
  });

  it('a clip with nothing usable above refuses a matte', () => {
    expect(setTrackMatte(base, 'img', Matte.Alpha).ok).toBe(false);
    expect(setTrackMatte(stacked, 'img', Matte.Alpha).ok).toBe(true);
  });

  it('a text clip used as matte becomes a text mask in its own box', () => {
    const doc = must(setTrackMatte(stacked, 'img', Matte.Alpha));

    expect(matteMask(clipOf(doc, 'title'), Matte.Alpha)).toMatchObject({ kind: 'text', text: 'GO', x: 0.5, y: 0.5, width: 0.6, height: 0.4, rotation: 5 });
    expect(hiddenMattes(doc)).toEqual(new Set(['title']));
  });

  it('a picture used as luma matte becomes a luminance mask', () => {
    const pic = must(addClip(must(addTrack(base, TrackKind.Visual, 'top')), { component: 'Image', from: 0, trackId: 'top', props: { assetId: 'lum' } }, 'lumpic'));

    expect(matteMask(clipOf(pic, 'lumpic'), Matte.Luma)).toMatchObject({ kind: 'luma', assetId: 'lum' });
    expect(matteMask(clipOf(pic, 'lumpic'), Matte.Alpha)).toMatchObject({ kind: 'image', assetId: 'lum' });
  });

  it('turning the matte off shows the source again', () => {
    const doc = must(setTrackMatte(must(setTrackMatte(stacked, 'img', Matte.Luma)), 'img', Matte.None));

    expect(hiddenMattes(doc).size).toBe(0);
  });
});

describe('editing a mask from the panels', () => {
  const masked = must(setMask(base, 'img', { kind: MaskKind.Rect }));

  it('a mask prop without keyframes edits the mask itself', () => {
    const doc = must(editAt(masked, clipOf(masked), 'maskWidth', 0.7, 10));

    expect(clipOf(doc).mask?.width).toBe(0.7);
    expect(clipOf(doc).keyframes).toEqual({});
  });

  it('mask lanes sit in their own group under the clip', () => {
    const keyed = must(setKeyframes(must(setKeyframes(masked, 'img', 'maskX', [{ frame: 0, value: 0.2, ease: Ease.Linear }])), 'img', 'rotateZ', [{ frame: 0, value: 1, ease: Ease.Linear }]));

    expect(keyLanes(clipOf(keyed)).map((l) => [l.prop, l.source])).toEqual([
      ['rotateZ', Source.Transform],
      ['maskX', Source.Mask]
    ]);
  });
});
