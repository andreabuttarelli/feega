import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { configuredAudioProvider } from '$lib/server/elevenlabs-config';
import { cachedVoices } from '$lib/server/canvas/audio-voices';
import { supabaseVoiceStore } from '$lib/server/voices/voice-store';

const SERVICE_UNAVAILABLE = 503;

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }

  const provider = configuredAudioProvider();
  if (!provider) {
    return json({ error: 'elevenlabs_not_configured' }, { status: SERVICE_UNAVAILABLE });
  }
  const [voices, custom] = await Promise.all([cachedVoices(provider), supabaseVoiceStore(resolved.caller.db).list(resolved.caller.orgId)]);
  return json({ voices, custom: custom.map((v) => ({ id: v.providerVoiceId, name: v.name, method: v.method })) });
};
