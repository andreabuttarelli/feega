import { AUDIO_OPERATIONS } from '$lib/canvas/audio-operations';
import { HIGGSFIELD_MODELS } from '$lib/server/higgsfield-catalogue';
import { KIE_TEXT_MODELS } from '$lib/server/kie-chat';
import { entry, providerLabel, unpriced, type PriceEntry } from './model-prices';

const CHARACTERS_PER_THOUSAND = 1000;
const SECONDS_PER_MINUTE = 60;

export const HIGGSFIELD_NOTE = 'Higgsfield quotes the price per request; not stored in the catalogue';

export function higgsfieldEntries(): PriceEntry[] {
  return HIGGSFIELD_MODELS.map((model) =>
    unpriced({ model: `${model.label} (${model.path})`, provider: providerLabel('higgsfield'), kind: model.catalogue }, 'per run', HIGGSFIELD_NOTE)
  );
}

export function kieTextEntries(): PriceEntry[] {
  return KIE_TEXT_MODELS.flatMap((model) => {
    const base = { model: `${model.label} (${model.id})`, provider: providerLabel('kie'), kind: 'text' };
    return [entry(base, 'per 1M input tokens', [model.usdPerMillionIn], ''), entry(base, 'per 1M output tokens', [model.usdPerMillionOut], '')];
  });
}

export function audioEntries(): PriceEntry[] {
  return Object.values(AUDIO_OPERATIONS).flatMap((operation) =>
    Object.entries(operation.usdPerUnit).map(([model, usdPerUnit]) => {
      const base = { model: `${operation.label} (${model})`, provider: providerLabel('elevenlabs'), kind: 'audio' };
      const perCharacters = operation.billedPer === 'character';
      const scale = perCharacters ? CHARACTERS_PER_THOUSAND : SECONDS_PER_MINUTE;
      return entry(base, perCharacters ? 'per 1000 characters' : 'per minute', [usdPerUnit * scale], '');
    })
  );
}
