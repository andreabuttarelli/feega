import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { isLocalMode } from '$lib/local-user';
import type { AudioOperationId } from '$lib/canvas/audio-operations';

export const MUSIC_UNAVAILABLE =
  "music_unavailable: music generation is not available on feega's current ElevenLabs plan. Voice-overs and sound effects still work.";

type Env = Record<string, string | undefined>;

const ENABLED_VALUES = new Set(['1', 'true']);

export function musicOffered(vars: Env): boolean {
  if (isLocalMode(vars) && vars.ELEVENLABS_API_KEY) {
    return true;
  }
  return ENABLED_VALUES.has(vars.ELEVENLABS_MUSIC_ENABLED ?? '');
}

export function musicRefusalFor(operation: AudioOperationId, vars: Env = { ...publicEnv, ...env }): string | null {
  return operation === 'music' && !musicOffered(vars) ? MUSIC_UNAVAILABLE : null;
}

export const musicEnabled = () => musicOffered({ ...publicEnv, ...env });
