import type { Db } from '$lib/server/db/client';
import type { VoiceRefusal } from '$lib/canvas/voices';
import { projectModeOf } from '$lib/server/uncensored-workspace/workspace-server';
import { audioVoices } from '$lib/server/canvas/audio-description';
import { voiceRefusalFor } from './custom-voices';
import { supabaseVoiceStore } from './voice-store';

async function premadeIds(): Promise<ReadonlySet<string> | null> {
  const voices = await audioVoices();
  return voices.length ? new Set(voices.map((v) => v.id)) : null;
}

export async function voiceUseRefusal(db: Db, input: { orgId: string; projectId: string; voiceId: string }): Promise<VoiceRefusal | null> {
  const mode = await projectModeOf(db, input);
  return voiceRefusalFor(supabaseVoiceStore(db), { orgId: input.orgId, voiceId: input.voiceId, mode, premade: await premadeIds() });
}
