import type { AudioProvider, Voice } from './audio-provider';

const VOICE_CACHE_MS = 60 * 60 * 1000;

export function voiceCatalogue(now: () => number = Date.now) {
  let cached: { at: number; voices: Voice[] } | null = null;

  return async function voices(provider: Pick<AudioProvider, 'voices'>): Promise<Voice[]> {
    if (cached && now() - cached.at <= VOICE_CACHE_MS) {
      return cached.voices;
    }
    const fresh = await provider.voices();
    cached = { at: now(), voices: fresh };
    return fresh;
  };
}

export const cachedVoices = voiceCatalogue();
