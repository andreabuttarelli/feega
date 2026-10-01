import { describe, expect, it } from 'vitest';
import {
  AUDIO_OPERATIONS,
  AUDIO_OPERATION_IDS,
  DEFAULT_AUDIO_OPERATION,
  audioCreditsFor,
  audioInputPorts,
  audioInputProblem,
  audioModelsOf,
  audioOperationOf,
  audioInputKindOf,
  audioNamedOutputs,
  audioOutputPorts,
  dubbedInputKind,
  audioUsdFor,
  defaultAudioModel
} from './audio-operations';

describe('audio operations table', () => {
  it('declares the six ElevenLabs operations', () => {
    expect([...AUDIO_OPERATION_IDS].sort()).toEqual(
      ['dubbing', 'music', 'sound_effects', 'text_to_speech', 'voice_changer', 'voice_isolation'].sort()
    );
  });

  it('gives every operation a label, a default model priced in its own table, and a cost unit', () => {
    for (const id of AUDIO_OPERATION_IDS) {
      const op = AUDIO_OPERATIONS[id];
      expect(op.label.length).toBeGreaterThan(0);
      expect((op.usdPerUnit as Record<string, number>)[op.defaultModel]).toBeGreaterThan(0);
      expect(['character', 'second']).toContain(op.billedPer);
    }
  });

  it('marks only dubbing as asynchronous', () => {
    const async = AUDIO_OPERATION_IDS.filter((id) => AUDIO_OPERATIONS[id].delivery === 'job');
    expect(async).toEqual(['dubbing']);
  });

  it('gives every operation at least one input port and one output port', () => {
    for (const id of AUDIO_OPERATION_IDS) {
      expect(audioInputPorts(id).length).toBeGreaterThan(0);
      for (const input of ['text', 'audio', 'video'] as const) {
        expect(audioOutputPorts(id, input).length).toBeGreaterThan(0);
      }
    }
  });

  it('text to speech takes text and outputs audio only', () => {
    expect(audioInputPorts('text_to_speech')).toEqual(['text']);
    expect(audioOutputPorts('text_to_speech', 'video')).toEqual(['audios']);
  });

  it('voice changer takes audio or video, outputs audio only', () => {
    expect(audioInputPorts('voice_changer')).toEqual(['audios', 'videos']);
    expect(audioOutputPorts('voice_changer', 'video')).toEqual(['audios']);
  });

  it('dubbing a video outputs the dubbed video and its audio track; dubbing audio outputs audio only', () => {
    expect(audioInputPorts('dubbing')).toEqual(['videos', 'audios']);
    expect(audioOutputPorts('dubbing', 'video')).toEqual(['videos', 'audios']);
    expect(audioOutputPorts('dubbing', 'audio')).toEqual(['audios']);
  });

  it('reads the input kind from what is wired, audio first like the run does', () => {
    expect(audioInputKindOf(['videos'])).toBe('video');
    expect(audioInputKindOf(['videos', 'audios'])).toBe('audio');
    expect(audioInputKindOf(['text'])).toBe('text');
  });

  it('reads the input kind of a dub from the file ElevenLabs returns, which keeps the source format', () => {
    expect(dubbedInputKind('video/mp4')).toBe('video');
    expect(dubbedInputKind('audio/mpeg')).toBe('audio');
  });

  it('music and sound effects take an optional text prompt, output audio only', () => {
    expect(audioInputPorts('music')).toEqual(['text']);
    expect(audioInputPorts('sound_effects')).toEqual(['text']);
    expect(audioOutputPorts('music', 'video')).toEqual(['audios']);
    expect(audioOutputPorts('sound_effects', 'video')).toEqual(['audios']);
  });

  it('voice isolation takes audio or video, outputs audio only', () => {
    expect(audioInputPorts('voice_isolation')).toEqual(['audios', 'videos']);
    expect(audioOutputPorts('voice_isolation', 'video')).toEqual(['audios']);
  });

  it('falls back to text to speech when the saved operation is unknown', () => {
    expect(audioOperationOf({ operation: 'karaoke' })).toBe(DEFAULT_AUDIO_OPERATION);
    expect(audioOperationOf({ operation: 'music' })).toBe('music');
  });

  it('resolves the default model per operation and refuses a model of another operation', () => {
    expect(defaultAudioModel('text_to_speech')).toBe('eleven_multilingual_v2');
    expect(audioModelsOf('text_to_speech')).toContain('eleven_flash_v2_5');
    expect(audioModelsOf('music')).not.toContain('eleven_flash_v2_5');
  });
});

describe('audio inputs per operation', () => {
  const none = { text: '', audio: 0, video: 0 };

  it('text to speech needs text, from the prompt or a connected node', () => {
    expect(audioInputProblem('text_to_speech', none, {})).toBe('text_required');
    expect(audioInputProblem('text_to_speech', { ...none, text: 'Ciao' }, { voiceId: 'v1' })).toBeNull();
  });

  it('text to speech and voice changer need a voice', () => {
    expect(audioInputProblem('text_to_speech', { ...none, text: 'Ciao' }, {})).toBe('voice_required');
    expect(audioInputProblem('voice_changer', { ...none, audio: 1 }, {})).toBe('voice_required');
  });

  it('media operations need a connected audio or video', () => {
    for (const id of ['voice_changer', 'voice_isolation', 'dubbing'] as const) {
      expect(audioInputProblem(id, none, { voiceId: 'v', targetLanguage: 'it' })).toBe('media_required');
      expect(audioInputProblem(id, { ...none, video: 1 }, { voiceId: 'v', targetLanguage: 'it' })).toBeNull();
    }
  });

  it('dubbing needs a target language', () => {
    expect(audioInputProblem('dubbing', { ...none, audio: 1 }, {})).toBe('language_required');
  });

  it('music and sound effects need a prompt and a duration inside the operation range', () => {
    expect(audioInputProblem('music', none, { duration: 30 })).toBe('text_required');
    expect(audioInputProblem('music', { ...none, text: 'lofi' }, { duration: 1 })).toBe('duration_out_of_range');
    expect(audioInputProblem('sound_effects', { ...none, text: 'door' }, { duration: 31 })).toBe('duration_out_of_range');
    expect(audioInputProblem('sound_effects', { ...none, text: 'door' }, { duration: 5 })).toBeNull();
  });
});

describe('audio cost', () => {
  it('prices text to speech per character at the model rate', () => {
    expect(audioUsdFor('text_to_speech', 'eleven_multilingual_v2', { characters: 1000 })).toBeCloseTo(0.08);
    expect(audioUsdFor('text_to_speech', 'eleven_flash_v2_5', { characters: 1000 })).toBeCloseTo(0.04);
  });

  it('prices music per second of output', () => {
    expect(audioUsdFor('music', 'music_v1', { seconds: 60 })).toBeCloseTo(0.15);
  });

  it('returns null when the measure is unknown, never an invented number', () => {
    expect(audioUsdFor('voice_isolation', 'audio_isolation', {})).toBeNull();
  });

  it('turns dollars into credit units at the subscription list rate', () => {
    expect(audioCreditsFor('text_to_speech', 'eleven_multilingual_v2', { characters: 1000 })).toBe(16);
    expect(audioCreditsFor('sound_effects', 'eleven_text_to_sound_v2', { seconds: 5 })).toBe(2);
  });
});

describe('audio node named outputs', () => {
  it('a dubbed video exposes a dubbed-video handle and an audio handle', () => {
    expect(audioNamedOutputs('dubbing', 'video').map((o) => [o.handle, o.port])).toEqual([
      ['out:videos', 'videos'],
      ['out:audios', 'audios']
    ]);
  });

  it('a single output needs no named handle', () => {
    expect(audioNamedOutputs('dubbing', 'audio')).toEqual([]);
    expect(audioNamedOutputs('text_to_speech', 'text')).toEqual([]);
  });
});
