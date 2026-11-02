import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { MotionStyle } from '@feega/motion-core/motion/style-model';
import { contentEnd, fitDuration, fitNewVideo, setDuration } from './fit-duration';
import { docProblems, Quality } from './direction';

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const SECOND = 30;

const phones = (): MotionDoc => {
  const blank = { ...newMotionDoc(MotionFormat.Landscape), style: MotionStyle.AppleMinimal, durationInFrames: 15 * SECOND };
  const backed = must(addClip(blank, { component: 'BrandBackground', from: 0, durationInFrames: 15 * SECOND, props: {} }, 'bg'));
  return must(addClip(backed, { component: 'Device3D', from: 0, durationInFrames: 6 * SECOND, props: {} }, 'phones'));
};

const emptyTail = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0 }).filter((p) => p.kind === Quality.TrailingEmpty || p.kind === Quality.EmptyFrames);

describe('fit duration to content', () => {
  it('the last content ends at 6 s, the backdrop does not count', () => {
    expect(contentEnd(phones())).toBe(6 * SECOND);
  });

  it('a film made of particles has content to its end, not an empty tail from 0 s', () => {
    const blank = { ...newMotionDoc(MotionFormat.Portrait), style: MotionStyle.AppleMinimal, durationInFrames: 15 * SECOND };
    const paper = must(addClip(blank, { component: 'Shape', from: 0, durationInFrames: 15 * SECOND, props: {} }, 'paper'));
    const dust = must(addClip(paper, { component: 'Particles', from: 0, durationInFrames: 15 * SECOND, props: {} }, 'dust'));

    expect(contentEnd(dust)).toBe(15 * SECOND);
    expect(emptyTail(dust)).toEqual([]);
  });

  it('fits the 15 s phones demo to 6 s plus the style hold, held on the last frame', () => {
    const doc = must(fitDuration(phones()));

    expect(doc.durationInFrames).toBe(7 * SECOND);
    expect(doc.tracks.flatMap((t) => t.clips).every((c) => c.from + c.durationInFrames <= doc.durationInFrames)).toBe(true);
    expect(emptyTail(doc)).toEqual([]);
  });

  it('refuses a video with no content', () => {
    expect(fitDuration(newMotionDoc(MotionFormat.Landscape)).ok).toBe(false);
  });

  it('a new video built without a chosen duration is fitted', () => {
    expect(fitNewVideo(newMotionDoc(MotionFormat.Landscape), phones()).durationInFrames).toBe(7 * SECOND);
  });

  it('a video whose duration the agent chose is left alone', () => {
    const start = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 10 * SECOND };

    expect(fitNewVideo(start, phones()).durationInFrames).toBe(15 * SECOND);
  });

  it('a video that already had content is left alone', () => {
    expect(fitNewVideo(phones(), phones()).durationInFrames).toBe(15 * SECOND);
  });
});

describe('the duration of a video', () => {
  const clipsOf = (doc: MotionDoc) => Object.fromEntries(doc.tracks.flatMap((t) => t.clips.map((c) => [c.id, [c.from, c.durationInFrames]])));

  it('shortens a 15 s video to 6 s by trimming the clips that run past the new end', () => {
    const doc = must(setDuration(phones(), 6 * SECOND));

    expect(doc.durationInFrames).toBe(6 * SECOND);
    expect(clipsOf(doc)).toMatchObject({ bg: [0, 6 * SECOND], phones: [0, 6 * SECOND] });
  });

  it('drops a clip that starts after the new end', () => {
    const late = must(addClip(phones(), { component: 'Shape', from: 10 * SECOND, durationInFrames: SECOND, props: {} }, 'late'));

    expect(clipsOf(must(setDuration(late, 6 * SECOND)))).not.toHaveProperty('late');
  });

  it('lengthens the clips that reached the old end, and leaves the others', () => {
    const doc = must(setDuration(phones(), 20 * SECOND));

    expect(clipsOf(doc)).toMatchObject({ bg: [0, 20 * SECOND], phones: [0, 6 * SECOND] });
  });

  it('drops a work area that no longer fits', () => {
    const looped = { ...phones(), workArea: { from: 0, to: 12 * SECOND } };

    expect(must(setDuration(looped, 6 * SECOND)).workArea).toBeNull();
    expect(must(setDuration({ ...looped, workArea: { from: 0, to: 3 * SECOND } }, 6 * SECOND)).workArea).toEqual({ from: 0, to: 3 * SECOND });
  });

  it('refuses a video longer than the limit', () => {
    expect(setDuration(phones(), 100_000).ok).toBe(false);
  });
});
