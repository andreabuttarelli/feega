import type { Purgers } from './canvas/provider-purge';
import { audioPurgers } from './canvas/audio-run';
import { taskPurgers } from './canvas/task-run';
import { configuredAudioProvider } from './elevenlabs-config';
import { configuredWiro } from './task-providers-config';

export function configuredPurgers(): Purgers {
  const wiro = configuredWiro();
  const audio = configuredAudioProvider();
  return {
    ...(wiro ? taskPurgers(wiro) : {}),
    ...(audio ? audioPurgers(audio) : {})
  };
}
