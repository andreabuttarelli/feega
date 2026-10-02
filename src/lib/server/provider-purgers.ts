import type { Purgers } from './canvas/provider-purge';
import { audioPurgers } from './canvas/audio-run';
import { wiroPurgers } from './canvas/wiro-run';
import { configuredAudioProvider } from './elevenlabs-config';
import { configuredWiro } from './wiro-config';

export function configuredPurgers(): Purgers {
  const wiro = configuredWiro();
  const audio = configuredAudioProvider();
  return {
    ...(wiro ? wiroPurgers(wiro) : {}),
    ...(audio ? audioPurgers(audio) : {})
  };
}
