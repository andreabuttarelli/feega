import { describe, expect, it } from 'vitest';
import { FORMATS, MotionFormat, newClip, newMotionDoc, parseMotionDoc } from './doc';
import { Quality, TIMELINE_ONLY, docProblems } from './direction';
import { ANIMATE_SECONDS, coverFrame, DocMode, animateStill, docMode, setStill, stillFrame } from './still';
import { setCanvas } from './timeline';
import { ImageFormat, IMAGE_FORMATS, ImageScale, stillExport } from './still-model';

describe('a still is a motion doc pinned to one frame', () => {
  it('a new doc is a video', () => {
    expect(docMode(newMotionDoc(MotionFormat.Portrait))).toBe(DocMode.Video);
  });

  it('setStill pins the frame at a time in seconds and the doc becomes a still', () => {
    const made = setStill(newMotionDoc(MotionFormat.Portrait), 2);

    expect(made.ok).toBe(true);
    const doc = made.ok ? made.doc : null;
    expect(doc && docMode(doc)).toBe(DocMode.Still);
    expect(doc && stillFrame(doc)).toBe(60);
  });

  it('a time past the end lands on the last frame, never outside the doc', () => {
    const doc = newMotionDoc(MotionFormat.Portrait);
    const made = setStill(doc, 999);

    expect(made.ok && stillFrame(made.doc)).toBe(doc.durationInFrames - 1);
  });

  it('setStill with null turns it back into a video', () => {
    const still = setStill(newMotionDoc(MotionFormat.Portrait), 1);
    const back = still.ok ? setStill(still.doc, null) : still;

    expect(back.ok && docMode(back.doc)).toBe(DocMode.Video);
  });

  it('the schema keeps the still across a save', () => {
    const still = setStill(newMotionDoc(MotionFormat.Portrait), 1);
    const parsed = still.ok ? parseMotionDoc(still.doc) : null;

    expect(parsed?.ok && parsed.doc.still).toEqual({ frame: 30 });
  });

  it('the schema refuses a still frame outside the doc', () => {
    const doc = { ...newMotionDoc(MotionFormat.Portrait), still: { frame: 10_000 } };

    expect(parseMotionDoc(doc).ok).toBe(false);
  });

  it('shortening a still keeps its frame inside the doc', () => {
    const still = setStill(newMotionDoc(MotionFormat.Portrait), 10);
    const short = still.ok ? setCanvas(still.doc, { durationInFrames: 30 }) : still;

    expect(short.ok && short.doc.still).toEqual({ frame: 29 });
  });

  it('a video doc shows its playhead, a still its pinned frame', () => {
    const still = setStill(newMotionDoc(MotionFormat.Portrait), 1);

    expect(stillFrame(newMotionDoc(MotionFormat.Portrait))).toBeNull();
    expect(still.ok && stillFrame(still.doc)).toBe(30);
  });
});

describe('a still is judged as one picture', () => {
  const titled = () => {
    const doc = newMotionDoc(MotionFormat.Portrait);
    const title = newClip({ id: 't', from: 0, durationInFrames: 30, component: 'Title', props: { text: 'Sale' } });
    return { ...doc, tracks: doc.tracks.map((t) => (t.id === 'v1' ? { ...t, clips: [title] } : t)) };
  };

  it('a video with a long empty tail is flagged', () => {
    expect(docProblems(titled(), { audioAssets: 0 }).map((p) => p.kind)).toContain(Quality.TrailingEmpty);
  });

  it('the same doc as a still is not asked for a tail, music, holes or holds', () => {
    const still = setStill(titled(), 0.5);
    const kinds = still.ok ? docProblems(still.doc, { audioAssets: 1 }).map((p) => p.kind) : [];

    expect(kinds.filter((k) => TIMELINE_ONLY.has(k))).toEqual([]);
  });
});

describe('poster formats', () => {
  it('the A-series poster keeps the 1:√2 ratio inside the 1080 short side', () => {
    const { width, height } = FORMATS[MotionFormat.Poster];

    expect(width).toBe(1080);
    expect(Math.abs(height / width - Math.SQRT2)).toBeLessThan(0.001);
  });

  it('post and story are the 4:5 and 9:16 sizes', () => {
    expect(FORMATS[MotionFormat.Portrait]).toMatchObject({ width: 1080, height: 1350 });
    expect(FORMATS[MotionFormat.Vertical]).toMatchObject({ width: 1080, height: 1920 });
  });
});

describe('image export settings', () => {
  it('png, jpg and webp each carry their mime and extension', () => {
    expect(IMAGE_FORMATS.map((f) => stillExport(f, ImageScale.One).mime)).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    expect(stillExport(ImageFormat.Jpg, ImageScale.One).ext).toBe('jpg');
  });

  it('2x doubles the pixels of the doc, 1x keeps them', () => {
    const doc = newMotionDoc(MotionFormat.Portrait);

    expect(stillExport(ImageFormat.Png, ImageScale.Two).size(doc)).toEqual({ width: 2160, height: 2700 });
    expect(stillExport(ImageFormat.Png, ImageScale.One).size(doc)).toEqual({ width: 1080, height: 1350 });
  });

  it('png is lossless: no quality, the lossy ones have one', () => {
    expect(stillExport(ImageFormat.Png, ImageScale.One).quality).toBeUndefined();
    expect(stillExport(ImageFormat.Jpg, ImageScale.One).quality).toBeGreaterThan(80);
  });
});

describe('Motion on a one-frame still makes it animatable', () => {
  const poster = () => {
    const doc = newMotionDoc(MotionFormat.Portrait);
    const clip = newClip({ id: 'title', from: 0, durationInFrames: 1, component: 'Title', props: { text: 'Poster' } });
    return { ...doc, durationInFrames: 1, still: { frame: 0 }, tracks: doc.tracks.map((t, i) => (i === 0 ? { ...t, clips: [clip] } : t)) };
  };

  it('the frame gets five seconds, becomes a video, and every element spans it', () => {
    const made = animateStill(poster());

    expect(made.ok).toBe(true);
    const doc = made.ok ? made.doc : poster();
    expect(doc.durationInFrames).toBe(ANIMATE_SECONDS * doc.fps);
    expect(docMode(doc)).toBe(DocMode.Video);
    expect(doc.tracks[0].clips[0]).toMatchObject({ from: 0, durationInFrames: doc.durationInFrames, props: { text: 'Poster' } });
  });

  it('a frame that already has a timeline is left as it is', () => {
    const video = newMotionDoc(MotionFormat.Portrait);

    expect(animateStill(video)).toEqual({ ok: true, doc: video });
  });
});

describe('the cover frame a frame node shows, closed or just opened', () => {
  it('is the middle of a video, past the entrances that leave frame 0 black', () => {
    expect(coverFrame({ durationInFrames: 90 })).toBe(45);
  });

  it('is the pinned frame of a still', () => {
    const made = setStill(newMotionDoc(MotionFormat.Portrait), 2);

    expect(made.ok && coverFrame(made.doc)).toBe(60);
  });
});
