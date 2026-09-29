import { env } from '$env/dynamic/private';
import { elevenLabs } from './elevenlabs';
import type { AudioProvider } from './canvas/audio-provider';

export function configuredAudioProvider(): AudioProvider | null {
  const apiKey = env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return null;
  }
  return elevenLabs({ apiKey, baseUrl: env.ELEVENLABS_BASE_URL || undefined });
}
