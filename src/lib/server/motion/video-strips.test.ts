import { describe, expect, it } from 'vitest';
import { STRIP_FPS, stripFrame, stripSteps, stripVideos } from './video-strips';

const page = [
  '<div><video id="c-v" src="https://x.co/a.mp4?t=1" crossorigin="anonymous" preload="auto" muted playsinline data-start="2" data-duration="3" data-media-start="0.5" style="width:100%;display:block"></video></div>',
  '<video id="dv-d" src="https://x.co/b.mp4" preload="auto" muted playsinline data-start="0" data-duration="4" data-media-start="0" data-playback-rate="2" style="opacity:0"></video>'
].join('');

describe('stripVideos', () => {
  it('takes every video away from the producer, which cannot blur injected frames', () => {
    const { html } = stripVideos(page);

    expect(html).not.toContain('<video');
    expect(html).toContain('<span data-strip="0" id="c-v"');
    expect(html).toContain('data-strip-style="width:100%;display:block"');
    expect(html).toContain('data-strip="0"');
    expect(html).toContain('data-strip="1"');
    expect(html).toContain('data-strip-start="2"');
  });

  it('lists each video with the stretch of media it plays', () => {
    const { strips } = stripVideos(page);

    expect(strips).toEqual([
      { url: 'https://x.co/a.mp4?t=1', start: 2, duration: 3, mediaStart: 0.5, rate: 1 },
      { url: 'https://x.co/b.mp4', start: 0, duration: 4, mediaStart: 0, rate: 2 }
    ]);
  });

  it('a page without video is left as it is', () => {
    expect(stripVideos('<div></div>')).toEqual({ html: '<div></div>', strips: [] });
  });
});

describe('stripFrame', () => {
  const strip = { start: 2, duration: 3, mediaStart: 0.5, rate: 1 };

  it('a sub-frame time picks the frame of the media at that instant, counted from the extracted stretch', () => {
    expect(stripFrame(strip, 2, STRIP_FPS)).toBe(1);
    expect(stripFrame(strip, 2 + 1 / STRIP_FPS, STRIP_FPS)).toBe(2);
    expect(stripFrame(strip, 2.5 + 0.25 / STRIP_FPS, STRIP_FPS)).toBe(1 + STRIP_FPS / 2);
  });

  it('outside its clip a video shows nothing', () => {
    expect(stripFrame(strip, 1.99, STRIP_FPS)).toBeNull();
    expect(stripFrame(strip, 5.01, STRIP_FPS)).toBeNull();
  });

  it('the playback rate speeds the media up', () => {
    expect(stripFrame({ ...strip, rate: 2 }, 3, STRIP_FPS)).toBe(1 + 2 * STRIP_FPS);
  });

  it('runs from its own source, as the page embeds it', () => {
    const inlined = new Function(`return (${String(stripFrame)});`)() as typeof stripFrame;

    expect(inlined(strip, 2.5, STRIP_FPS)).toBe(stripFrame(strip, 2.5, STRIP_FPS));
  });
});

describe('stripSteps', () => {
  it('extracts the played stretch of each video into the project before the render', () => {
    const steps = stripSteps('/job/project', stripVideos(page).strips);
    const line = steps.map((s) => [s.cmd, ...s.args].join(' ')).join('\n');

    expect(line).toContain('-ss 0.5');
    expect(line).toContain('-t 3');
    expect(line).toContain('-t 8');
    expect(line).toContain(`fps=${STRIP_FPS}`);
    expect(line).toContain('/job/project/strips/1/%d.jpg');
  });
});
