import type { Db } from '$lib/server/db/client';
import type { VoiceRefusal } from '$lib/canvas/voices';
import { projectModeOf } from '$lib/server/uncensored-workspace/workspace-server';
import { voiceRefusalFor } from './custom-voices';
import { supabaseVoiceStore } from './voice-store';

export async function voiceUseRefusal(db: Db, input: { orgId: string; projectId: string; voiceId: string }): Promise<VoiceRefusal | null> {
  const mode = await projectModeOf(db, input);
  return voiceRefusalFor(supabaseVoiceStore(db), { orgId: input.orgId, voiceId: input.voiceId, mode });
}
