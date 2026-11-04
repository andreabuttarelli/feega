import { describe, expect, it, vi } from 'vitest';
const encoded: { frames: number }[] = [];

vi.mock('./encode', () => ({
  encodeMp4: async (job: { gate?: () => Promise<void>; frames: number; render: (onFrame: () => Promise<void>) => Promise<void> }) => {
    encoded.push(job);
    await job.gate?.();
    await job.render(async () => {});
    return new Blob(['mp4']);
  },
  mixAudio: async () => null
}));

const { renderInBrowser } = await import('./browser-render');

const hiddenPage = { hidden: true, addEventListener: () => {}, removeEventListener: () => {} };
const doc = { fps: 30, durationInFrames: 30, width: 64, height: 64, clips: [], tracks: [], motionBlur: { enabled: false } };

describe('renderInBrowser', () => {
  it('a tab in the background keeps rendering instead of waiting to be seen again', async () => {
    const job = renderInBrowser({
      doc: doc as never,
      assetUrls: {},
      size: { width: 64, height: 64 },
      quality: 'standard' as never,
      withAudio: false,
      frames: async () => {},
      signal: new AbortController().signal,
      onStage: () => {},
      onFrame: () => {},
      host: { nav: {}, page: hiddenPage }
    });
    const stalled = new Promise((_, ko) => setTimeout(() => ko(new Error('stalled while hidden')), 200));
    await expect(Promise.race([job, stalled])).resolves.toBeInstanceOf(Blob);
  });

  it('a range draws only the frames inside it', async () => {
    const asked: number[][] = [];
    await renderInBrowser({
      doc: doc as never,
      assetUrls: {},
      size: { width: 64, height: 64 },
      quality: 'standard' as never,
      withAudio: false,
      range: { from: 0.5, to: 0.6 },
      frames: async (times) => void asked.push(times),
      signal: new AbortController().signal,
      onStage: () => {},
      onFrame: () => {},
      host: { nav: {}, page: hiddenPage }
    });
    expect(encoded.at(-1)?.frames).toBe(3);
    expect(asked).toEqual([[15 / 30, 16 / 30, 17 / 30]]);
  });
});
