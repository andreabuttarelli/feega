import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { runAudio } from '$lib/server/canvas/audio-run';
import { voiceUseRefusal } from '$lib/server/voices/voice-guard';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import { defaultAudioModel, voiceIdOf, type AudioOperationId, type AudioParams } from '$lib/canvas/audio-operations';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import type { Voiceover } from './motion-tools';

const AUDIO_NOT_CONFIGURED = 'elevenlabs_not_configured';

export type VoiceoverScope = { orgId: string; projectId: string; nodeId: string; userId: string; actor: Actor };

export enum Sound {
  Voice = 'voice',
  Music = 'music'
}

type SoundSpec = { operation: AudioOperationId; params: (input: SoundInput) => AudioParams };
export type SoundInput = { text: string; voiceId?: string; seconds?: number };

const SOUNDS: Record<Sound, SoundSpec> = {
  [Sound.Voice]: {
    operation: 'text_to_speech',
    params: (input) => ({ operation: 'text_to_speech', voiceId: voiceIdOf({ voiceId: input.voiceId }) })
  },
  [Sound.Music]: {
    operation: 'music',
    params: (input) => ({ operation: 'music', duration: input.seconds })
  }
};

export async function generateSound(db: Db, scope: VoiceoverScope, sound: Sound, input: SoundInput): Promise<Voiceover> {
  const screened = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: [input.text], scope: { ...scope, actor: scope.actor } });
  if (!screened.ok) {
    return { ok: false, error: 'blocked_by_moderation' };
  }

  const { configuredAudioProvider } = await import('$lib/server/elevenlabs-config');
  const provider = configuredAudioProvider();
  if (!provider) {
    return { ok: false, error: AUDIO_NOT_CONFIGURED };
  }

  const spec = SOUNDS[sound];
  const params = spec.params(input);
  const refusal = params.voiceId ? await voiceUseRefusal(db, { orgId: scope.orgId, projectId: scope.projectId, voiceId: params.voiceId }) : null;
  if (refusal) {
    return { ok: false, error: refusal };
  }

  const out = await runAudio(db, provider, {
    scope,
    operation: spec.operation,
    model: defaultAudioModel(spec.operation),
    params,
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

export function speakVoiceover(db: Db, scope: VoiceoverScope, input: { text: string; voiceId?: string }): Promise<Voiceover> {
  return generateSound(db, scope, Sound.Voice, input);
}
