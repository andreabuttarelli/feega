import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { briefCanvas, sizedToBrief } from './brief-canvas';

describe('the size and length a brief asks for', () => {
  it.each([
    ['Kinetic typography video of this quote. Square 1080x1080, about 10 seconds.', MotionFormat.Square, 10],
    ['Make a 20-second launch teaser video for Linear (linear.app). 16:9, 1920x1080.', MotionFormat.Landscape, 20],
    ['Feature showcase video, vertical 1080x1920, about 20 seconds.', MotionFormat.Vertical, 20],
    ['A 15-second vertical (1080x1920) Instagram promo for Nordbrew.', MotionFormat.Vertical, 15],
    ['An 8-second generative abstract animation. Square 1080x1080, it must loop seamlessly.', MotionFormat.Square, 8],
    ['un video 4:5 di 12 secondi', MotionFormat.Portrait, 12],
    ['a 6s logo reveal in landscape', MotionFormat.Landscape, 6]
  ])('%s', (brief, format, seconds) => {
    expect(briefCanvas(brief)).toEqual({ format, seconds });
  });

  it('a brief that names neither leaves the video as it is', () => {
    expect(briefCanvas('make it pop')).toEqual({});
  });

  it('the quote that came out 1080x1920 and 15 s is saved square and 10 s before the agent writes anything', () => {
    const blank = newMotionDoc(MotionFormat.Vertical);

    const sized = sizedToBrief(blank, 'Kinetic typography video. Square 1080x1080, about 10 seconds.');

    expect(sized && { width: sized.width, height: sized.height, seconds: sized.durationInFrames / sized.fps }).toEqual({ width: 1080, height: 1080, seconds: 10 });
  });

  it('a video already built keeps its size: a later message is an edit, not a new brief', () => {
    const built = { ...newMotionDoc(MotionFormat.Vertical) };
    built.tracks = built.tracks.map((t, i) => (i === 0 ? { ...t, clips: [{ id: 'a', component: 'Title', from: 0, durationInFrames: 30, props: { text: 'x' } } as never] } : t));

    expect(sizedToBrief(built, 'make it square, 10 seconds')).toBeNull();
  });
});
