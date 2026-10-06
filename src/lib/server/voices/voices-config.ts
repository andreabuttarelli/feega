import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { logAiCall } from '$lib/server/ai-log';
import { elevenLabsVoices } from '$lib/server/elevenlabs-voices';
import type { VoiceBill, VoiceDeps } from './custom-voices';
import { supabaseVoiceStore } from './voice-store';

const LABEL = 'canvas.voice';
const PROVIDER = 'elevenlabs';

function billVoice(entry: VoiceBill): void {
  logAiCall({
    label: LABEL,
    context: entry.method,
    provider: PROVIDER,
    model: entry.method,
    ms: entry.ms,
    ok: entry.ok,
    error: entry.error,
    flatCostUsd: entry.costUsd ?? undefined,
    orgId: entry.orgId,
    userId: entry.userId,
    actorKind: entry.actor.kind,
    actorId: entry.actor.id ?? entry.userId,
    agentKey: entry.actor.agentKey ?? null
  });
}

export function configuredVoiceDeps(db: Db): VoiceDeps | null {
  const apiKey = env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return null;
  }
  const provider = elevenLabsVoices({ apiKey, baseUrl: env.ELEVENLABS_BASE_URL || undefined });
  return { store: supabaseVoiceStore(db), provider, bill: billVoice, plan: null };
}
