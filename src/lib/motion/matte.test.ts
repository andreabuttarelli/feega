import { describe, expect, it } from 'vitest';
import { TrackKind } from './components';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { Matte } from './mask';
import { MATTE_OPAQUE, MATTE_READ, matteAlpha, mattePairs } from './matte';
import { addClip, addTrack, setKeyframes, setTrackMatte, type OpResult } from './timeline';
import { Ease } from './design';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const below = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 0, durationInFrames: 90, props: { assetId: 'pic' } }, 'img'));
const over = (component: string, props: Record<string, unknown> = {}) =>
  must(addClip(must(addTrack(below, TrackKind.Visual, 'top')), { component: component as never, from: 0, durationInFrames: 90, trackId: 'top', props }, 'src'));

describe('the matte is the rendered source, read pixel by pixel', () => {
  const RED = [255, 0, 0] as const;
  const WHITE = [255, 255, 255] as const;

  it('alpha keeps the source coverage, inverted alpha the rest', () => {
    expect(matteAlpha(MATTE_READ[Matte.Alpha], ...RED, 200)).toBe(200);
    expect(matteAlpha(MATTE_READ[Matte.AlphaInverted], ...RED, 200)).toBe(55);
  });

  it('luma reads brightness of what is drawn, so an empty pixel is dark', () => {
    expect(matteAlpha(MATTE_READ[Matte.Luma], ...WHITE, MATTE_OPAQUE)).toBe(MATTE_OPAQUE);
    expect(matteAlpha(MATTE_READ[Matte.Luma], ...WHITE, 0)).toBe(0);
    expect(matteAlpha(MATTE_READ[Matte.Luma], ...RED, MATTE_OPAQUE)).toBe(54);
    expect(matteAlpha(MATTE_READ[Matte.LumaInverted], ...RED, MATTE_OPAQUE)).toBe(201);
    expect(matteAlpha(MATTE_READ[Matte.LumaInverted], 0, 0, 0, 0)).toBe(MATTE_OPAQUE);
  });

  it('runs alone, so the page can carry it as source text', () => {
    const copy = new Function(`return (${matteAlpha.toString()})`)() as typeof matteAlpha;

    expect(copy(MATTE_READ[Matte.LumaInverted], ...RED, MATTE_OPAQUE)).toBe(201);
  });
});

describe('any clip can be a track matte', () => {
  it.each([['Video', { assetId: 'clip' }], ['Shape3D', {}], ['Title', { text: 'GO' }]])('%s above can matte the clip below', (component, props) => {
    const doc = over(component, props);

    expect(setTrackMatte(doc, 'img', Matte.LumaInverted).ok).toBe(true);
  });

  it('an animated source is still a matte: the page renders it, keyframes included', () => {
    const keyed = must(setKeyframes(over('Title', { text: 'GO' }), 'src', 'scale', [{ frame: 0, value: 0.2, ease: Ease.Linear }, { frame: 60, value: 3, ease: Ease.Linear }]));
    const doc = must(setTrackMatte(keyed, 'img', Matte.Alpha));

    expect(mattePairs(doc)).toEqual([{ target: 'img', source: 'src', matte: Matte.Alpha }]);
  });

  it('a clip without a matte is not a pair', () => {
    expect(mattePairs(over('Title', { text: 'GO' }))).toEqual([]);
  });
});
