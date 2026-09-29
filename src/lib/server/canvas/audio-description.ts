import { AUDIO_OPERATION_IDS, DUBBING_LANGUAGES, audioModelsOf, operationSpec } from '$lib/canvas/audio-operations';
import { configuredAudioProvider } from '$lib/server/elevenlabs-config';
import { cachedVoices } from './audio-voices';
import type { Voice } from './audio-provider';

export function audioOperations() {
  return Object.fromEntries(
    AUDIO_OPERATION_IDS.map((id) => {
      const op = operationSpec(id);
      return [
        id,
        {
          label: op.label,
          source: op.source,
          needs_voice: op.needsVoice,
          needs_language: op.needsLanguage,
          duration_seconds: op.duration,
          delivery: op.delivery,
          default_model: op.defaultModel,
          models: audioModelsOf(id),
          billed_per: op.billedPer,
          usd_per_unit: op.usdPerUnit
        }
      ];
    })
  );
}

export function audioTables() {
  return { audio_operations: audioOperations(), dubbing_languages: DUBBING_LANGUAGES };
}

export async function audioVoices(): Promise<Voice[]> {
  const provider = configuredAudioProvider();
  return provider ? cachedVoices(provider).catch(() => []) : [];
}

export async function audioDescription() {
  return { ...audioTables(), voices: await audioVoices() };
}
