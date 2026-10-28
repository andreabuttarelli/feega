import { describe, expect, it } from 'vitest';
import { MUSIC_UNAVAILABLE, musicOffered, musicRefusalFor } from './elevenlabs-music';

const KEY = { ELEVENLABS_API_KEY: 'sk' };

describe('the music switch', () => {
  it('is off by default', () => {
    expect(musicOffered({})).toBe(false);
    expect(musicOffered(KEY)).toBe(false);
  });

  it('is on when the flag is on', () => {
    expect(musicOffered({ ELEVENLABS_MUSIC_ENABLED: '1' })).toBe(true);
    expect(musicOffered({ ELEVENLABS_MUSIC_ENABLED: 'true' })).toBe(true);
    expect(musicOffered({ ELEVENLABS_MUSIC_ENABLED: '0' })).toBe(false);
  });

  it('is on in local mode with a key, whatever the flag says', () => {
    expect(musicOffered({ ...KEY, PUBLIC_FEEGA_LOCAL: '1' })).toBe(true);
    expect(musicOffered({ ...KEY, PUBLIC_FEEGA_LOCAL: '1', ELEVENLABS_MUSIC_ENABLED: '0' })).toBe(true);
  });

  it('stays off in local mode without a key', () => {
    expect(musicOffered({ PUBLIC_FEEGA_LOCAL: '1' })).toBe(false);
  });

  it('refuses only the music operation, and only while off', () => {
    expect(musicRefusalFor('music', {})).toBe(MUSIC_UNAVAILABLE);
    expect(musicRefusalFor('text_to_speech', {})).toBeNull();
    expect(musicRefusalFor('sound_effects', {})).toBeNull();
    expect(musicRefusalFor('music', { ELEVENLABS_MUSIC_ENABLED: '1' })).toBeNull();
  });
});
