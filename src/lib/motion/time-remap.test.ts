import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from './brand';
import { Ease } from './design';
import { MotionFormat, findClip, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { addClip, setKeyframes, setProps, type OpResult } from './timeline';
import { composeHtml } from './hyperframes/compose';
import { audioPlan } from './audio-plan';
import { keyframesProblem } from './keyframes';
import { REMAP_KEY, clearTimeRemap, enableTimeRemap, freezeFrame, isRemapped, mediaSegments, sourceSeconds } from './time-remap';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const FPS = 30;
const video = (props: Record<string, unknown> = {}, keyframes: MotionClip['keyframes'] = {}, trimStart = 0): MotionClip =>
  ({ id: 'v', component: 'Video', from: 30, durationInFrames: 60, trimStart, props: { assetId: 'a', speed: 1, reverse: false, ...props }, keyframes, transform: {} }) as unknown as MotionClip;

const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Video', from: 30, durationInFrames: 60, props: { assetId: 'a', volume: 0.8 } }, 'v'));
const clipIn = (doc: MotionDoc) => findClip(doc, 'v')!.clip;
const html = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: { a: '/v.mp4' } });

describe('source time is a pure function of the clip frame', () => {
  it('plays from the trim at normal speed', () => {
    expect(sourceSeconds(video({}, {}, 15), 30, FPS)).toBeCloseTo(1.5);
  });

  it('a constant speed scales the source time', () => {
    expect(sourceSeconds(video({ speed: 2 }), 30, FPS)).toBeCloseTo(2);
    expect(sourceSeconds(video({ speed: 0.5 }), 30, FPS)).toBeCloseTo(0.5);
  });

  it('reverse plays the same span backwards, ending on the first source frame', () => {
    expect(sourceSeconds(video({ reverse: true }), 0, FPS)).toBeCloseTo(59 / 30);
    expect(sourceSeconds(video({ reverse: true }), 59, FPS)).toBeCloseTo(0);
  });

  it('time remap keyframes say which source second shows at each frame', () => {
    const ramp = video({}, { [REMAP_KEY]: [{ frame: 0, value: 4, ease: Ease.Linear }, { frame: 30, value: 1, ease: Ease.Linear }] });
    expect(sourceSeconds(ramp, 15, FPS)).toBeCloseTo(2.5);
    expect(sourceSeconds(ramp, 45, FPS)).toBeCloseTo(1);
  });

  it('keyframes win over speed and reverse', () => {
    const keyed = video({ speed: 3, reverse: true }, { [REMAP_KEY]: [{ frame: 0, value: 2, ease: Ease.Linear }] });
    expect(sourceSeconds(keyed, 40, FPS)).toBeCloseTo(2);
  });
});

describe('media segments', () => {
  it('a plain clip stays one segment at rate 1', () => {
    expect(isRemapped(video())).toBe(false);
    expect(mediaSegments(video({}, {}, 15), FPS)).toEqual([{ at: 1, duration: 2, mediaStart: 0.5, rate: 1 }]);
  });

  it('a constant speed is one segment at that rate', () => {
    expect(mediaSegments(video({ speed: 2.5 }), FPS)).toEqual([{ at: 1, duration: 2, mediaStart: 0, rate: 2.5 }]);
  });

  it('reverse is one frame per segment, each a step back in the source', () => {
    const segments = mediaSegments(video({ reverse: true }), FPS);
    expect(segments).toHaveLength(60);
    expect(segments[0]).toMatchObject({ at: 1, mediaStart: 59 / 30 });
    expect(segments[59].mediaStart).toBeCloseTo(0);
  });

  it('a freeze holds one source frame for the whole clip', () => {
    const segments = mediaSegments(video({}, { [REMAP_KEY]: [{ frame: 0, value: 1.2, ease: Ease.Linear }] }), FPS);
    expect(new Set(segments.map((s) => s.mediaStart))).toEqual(new Set([1.2]));
    expect(segments.reduce((sum, s) => sum + s.duration, 0)).toBeCloseTo(2);
  });

  it('a linear ramp between two keyframes is one segment at the slope', () => {
    const segments = mediaSegments(video({}, { [REMAP_KEY]: [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 59, value: 59 / 15, ease: Ease.Linear }] }), FPS);
    expect(segments).toHaveLength(1);
    expect(segments[0].rate).toBeCloseTo(2);
  });

  it('segments cover the clip without gaps, whatever the curve', () => {
    const curve = video({}, { [REMAP_KEY]: [{ frame: 0, value: 0, ease: Ease.Standard }, { frame: 20, value: 3, ease: Ease.Linear }, { frame: 40, value: 1, ease: Ease.Linear }] });
    const segments = mediaSegments(curve, FPS);
    segments.forEach((s, i) => {
      const next = segments[i + 1];
      if (next) {
        expect(next.at).toBeCloseTo(s.at + s.duration);
      }
    });
    expect(segments[0].at).toBe(1);
    expect(segments.reduce((sum, s) => sum + s.duration, 0)).toBeCloseTo(2);
  });
});

describe('time remap edits', () => {
  it('enabling remap keys the current mapping at both ends', () => {
    const doc = must(enableTimeRemap(must(setProps(base, 'v', { speed: 2 })), 'v'));
    expect(clipIn(doc).keyframes[REMAP_KEY].map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [59, 59 / 15]
    ]);
  });

  it('a freeze frame holds the source frame showing at the playhead', () => {
    const doc = must(freezeFrame(must(setProps(base, 'v', { speed: 2 })), 'v', 30 + 15));
    expect(clipIn(doc).keyframes[REMAP_KEY]).toEqual([{ frame: 15, value: 1, ease: Ease.Linear }]);
  });

  it('clearing goes back to plain playback', () => {
    const doc = must(clearTimeRemap(must(freezeFrame(must(setProps(base, 'v', { speed: 2, reverse: true })), 'v', 40)), 'v'));
    expect(isRemapped(clipIn(doc))).toBe(false);
  });

  it('remap only exists on video clips', () => {
    expect(keyframesProblem({ component: 'Video', mask: null, keyframes: { [REMAP_KEY]: [{ frame: 0, value: 2, ease: Ease.Linear }] } })).toBeNull();
    expect(keyframesProblem({ component: 'Image', mask: null, keyframes: { [REMAP_KEY]: [{ frame: 0, value: 2, ease: Ease.Linear }] } })).not.toBeNull();
    const doc = must(addClip(base, { component: 'Title', from: 0, durationInFrames: 30 }, 't'));
    expect(freezeFrame(doc, 't', 0).ok).toBe(false);
  });
});

describe('time remap in the composition', () => {
  it('a plain video keeps its single media element', () => {
    expect(html(base)).toMatch(/<video id="c-v" src="\/v.mp4"[^>]*data-start="1" data-duration="2" data-media-start="0"/);
  });

  it('a constant speed reaches the media element as its playback rate', () => {
    expect(html(must(setProps(base, 'v', { speed: 2 })))).toMatch(/<video id="c-v-s0"[^>]*data-start="1" data-duration="2" data-media-start="0" data-playback-rate="2"/);
  });

  it('reverse composes one element per frame, the same in every render path', () => {
    const page = html(must(setProps(base, 'v', { reverse: true })));
    expect(page.match(/<video id="c-v-s\d+"/g)).toHaveLength(60);
    expect(page).toContain('id="c-v-s59" src="/v.mp4"');
    expect(html(must(setProps(base, 'v', { reverse: true })))).toBe(page);
  });

  it('a remapped clip is silent: its sound would not follow the picture', () => {
    expect(audioPlan(base, { a: '/v.mp4' })).toHaveLength(1);
    expect(audioPlan(must(setProps(base, 'v', { speed: 2 })), { a: '/v.mp4' })).toHaveLength(0);
    expect(html(must(setProps(base, 'v', { speed: 2 })))).not.toContain('data-has-audio');
  });

  it('a keyed remap round-trips through set_keyframes validation', () => {
    expect(setKeyframes(base, 'v', REMAP_KEY, [{ frame: 0, value: 1, ease: Ease.Linear }]).ok).toBe(true);
  });
});
