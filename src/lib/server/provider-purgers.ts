import type { Purgers } from './canvas/provider-purge';
import { audioPurgers } from './canvas/audio-run';
import { taskPurgers } from './canvas/task-run';
import { configuredAudioProvider } from './elevenlabs-config';
import { configuredTaskProviders } from './task-providers-config';

export function configuredPurgers(): Purgers {
  const audio = configuredAudioProvider();
  return {
    ...taskPurgers(configuredTaskProviders()),
    ...(audio ? audioPurgers(audio) : {})
  };
}
