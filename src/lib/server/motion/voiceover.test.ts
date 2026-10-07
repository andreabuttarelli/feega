import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VOICE } from '$lib/canvas/audio-operations';

const { runAudio, voiceUseRefusal } = vi.hoisted(() => ({ runAudio: vi.fn(), voiceUseRefusal: vi.fn() }));
vi.mock('$lib/server/canvas/audio-run', () => ({ runAudio }));
vi.mock('$lib/server/voices/voice-guard', () => ({ voiceUseRefusal }));
vi.mock('$lib/server/elevenlabs-config', () => ({ configuredAudioProvider: () => ({}) }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/canvas/sign-media', () => ({
  createAssetSigningDb: () => ({}),
  signAssetPaths: async () => new Map([['p', 'https://signed']])
}));

import { speakVoiceover } from './voiceover';

const SCOPE = { orgId: 'o', projectId: 'p1', nodeId: 'n', userId: 'u', actor: { kind: 'user' as const, id: 'u' } };

beforeEach(() => {
  runAudio.mockReset();
  runAudio.mockResolvedValue({ kind: 'landed', asset: { id: 'a', url: 'p', durationS: 2 } });
  voiceUseRefusal.mockReset();
  voiceUseRefusal.mockResolvedValue(null);
});

describe('the motion voice-over', () => {
  it('speaks with the default voice when none is given', async () => {
    expect(await speakVoiceover({} as never, SCOPE, { text: 'hi' })).toEqual({ ok: true, assetId: 'a', seconds: 2, url: 'https://signed' });
    expect(runAudio.mock.calls[0][2].params.voiceId).toBe(DEFAULT_VOICE.id);
  });

  it('refuses a voice another workspace owns', async () => {
    voiceUseRefusal.mockResolvedValue('voice_not_yours');
    expect(await speakVoiceover({} as never, SCOPE, { text: 'hi', voiceId: 'theirs' })).toEqual({ ok: false, error: 'voice_not_yours' });
    expect(voiceUseRefusal).toHaveBeenCalledWith({}, { orgId: 'o', projectId: 'p1', voiceId: 'theirs' });
    expect(runAudio).not.toHaveBeenCalled();
  });
});
