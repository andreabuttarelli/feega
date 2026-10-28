import type { Db } from '$lib/server/db/client';
import type { VoiceRefusal } from '$lib/canvas/voices';
import { projectModeOf } from '$lib/server/uncensored-workspace/workspace-server';
import { configuredAudioProvider } from '$lib/server/elevenlabs-config';
import { cachedVoices } from '$lib/server/canvas/audio-voices';
import { voiceRefusalFor } from './custom-voices';
import { supabaseVoiceStore } from './voice-store';

async function premadeIds(): Promise<ReadonlySet<string> | null> {
  const provider = configuredAudioProvider();
  if (!provider) {
    return null;
  }
  return cachedVoices(provider).then((voices) => new Set(voices.map((v) => v.id))).catch(() => null);
}

export async function voiceUseRefusal(db: Db, input: { orgId: string; projectId: string; voiceId: string }): Promise<VoiceRefusal | null> {
  const mode = await projectModeOf(db, input);
  return voiceRefusalFor(supabaseVoiceStore(db), { orgId: input.orgId, voiceId: input.voiceId, mode, premade: await premadeIds() });
}
