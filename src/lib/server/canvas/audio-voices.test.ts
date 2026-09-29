import { describe, expect, it, vi } from 'vitest';
import { voiceCatalogue } from './audio-voices';

const RACHEL = { id: 'v1', name: 'Rachel', previewUrl: 'https://p/1.mp3', category: 'premade', labels: {} };

describe('the voice catalogue', () => {
  it('asks ElevenLabs once and serves the cached list until it expires', async () => {
    const voices = vi.fn(async () => [RACHEL]);
    const catalogue = voiceCatalogue(() => 0);

    expect(await catalogue({ voices } as never)).toEqual([RACHEL]);
    expect(await catalogue({ voices } as never)).toEqual([RACHEL]);
    expect(voices).toHaveBeenCalledTimes(1);
  });

  it('asks again after an hour', async () => {
    let now = 0;
    const voices = vi.fn(async () => [RACHEL]);
    const catalogue = voiceCatalogue(() => now);

    await catalogue({ voices } as never);
    now = 60 * 60 * 1000 + 1;
    await catalogue({ voices } as never);

    expect(voices).toHaveBeenCalledTimes(2);
  });
});
