import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { runAudio } from '$lib/server/canvas/audio-run';
import { cachedVoices } from '$lib/server/canvas/audio-voices';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import { defaultAudioModel } from '$lib/canvas/audio-operations';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import type { Voiceover } from './motion-tools';

const AUDIO_NOT_CONFIGURED = 'elevenlabs_not_configured';
const NO_VOICE = 'no_voice_available';
const OPERATION = 'text_to_speech';

export type VoiceoverScope = { orgId: string; projectId: string; nodeId: string; userId: string; actor: Actor };

export async function speakVoiceover(db: Db, scope: VoiceoverScope, input: { text: string; voiceId?: string }): Promise<Voiceover> {
  const screened = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: [input.text], scope: { ...scope, actor: scope.actor } });
  if (!screened.ok) {
    return { ok: false, error: 'blocked_by_moderation' };
  }

  const { configuredAudioProvider } = await import('$lib/server/elevenlabs-config');
  const provider = configuredAudioProvider();
  if (!provider) {
    return { ok: false, error: AUDIO_NOT_CONFIGURED };
  }

  const voiceId = input.voiceId ?? (await cachedVoices(provider))[0]?.id;
  if (!voiceId) {
    return { ok: false, error: NO_VOICE };
  }

  const out = await runAudio(db, provider, {
    scope,
    operation: OPERATION,
    model: defaultAudioModel(OPERATION),
    params: { operation: OPERATION, voiceId },
    text: input.text,
    audioUrls: [],
    videoUrls: []
  });
  if (out.kind !== 'landed') {
    return { ok: false, error: out.kind === 'refused' ? out.error : 'voiceover_pending' };
  }

  const path = out.asset.url ?? '';
  const signed = await signAssetPaths(db, createAssetSigningDb(), { generated: [path], uploaded: [] });
  return { ok: true, assetId: out.asset.id, seconds: out.asset.durationS ?? 0, url: signed.get(path) ?? null };
}
