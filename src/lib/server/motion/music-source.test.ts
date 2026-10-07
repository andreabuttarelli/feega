import { describe, expect, it, vi } from 'vitest';
import { MUSIC_BED_LICENSE } from './music-bed';
import { musicOrBed } from './music-source';

const stored = { ok: true as const, assetId: 'bed', seconds: 15, url: 'https://x/bed.wav' };

describe('music for a video, always', () => {
  it('uses the generated track when the music provider answers', async () => {
    const store = vi.fn(async () => stored);

    const out = await musicOrBed({ generate: async () => ({ ok: true, assetId: 'gen', seconds: 15, url: 'https://x/gen.mp3' }), store }, { text: 'electronic', seconds: 15 });

    expect(out).toMatchObject({ ok: true, assetId: 'gen' });
    expect(store).not.toHaveBeenCalled();
  });

  it('falls back to the CC0 bed, with its license, when the provider is missing or fails', async () => {
    const store = vi.fn(async () => stored);

    const out = await musicOrBed({ generate: async () => ({ ok: false, error: 'elevenlabs_not_configured' }), store }, { text: 'electronic 128 bpm', seconds: 15 });

    expect(out).toMatchObject({ ok: true, assetId: 'bed', license: MUSIC_BED_LICENSE });
    expect(store).toHaveBeenCalledWith(expect.any(Buffer), { seconds: 15, bpm: 128 });
  });

  it('reads the tempo from the prompt, 120 when it names none', async () => {
    const store = vi.fn(async () => stored);

    await musicOrBed({ generate: async () => ({ ok: false, error: 'x' }), store }, { text: 'calm piano', seconds: 10 });

    expect(store).toHaveBeenCalledWith(expect.any(Buffer), { seconds: 10, bpm: 120 });
  });
});
