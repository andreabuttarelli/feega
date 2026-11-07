import { describe, expect, it } from 'vitest';
import { audioModelFor, isWiroAudioModel } from './audio-operations';

describe('a Wiro model picked on an audio node', () => {
  it('stays the model, whatever the operation', () => {
    expect(audioModelFor('text_to_speech', 'wiro/google/lyria-3')).toBe('wiro/google/lyria-3');
    expect(isWiroAudioModel('wiro/google/lyria-3')).toBe(true);
  });

  it('leaves an unknown ElevenLabs id falling back to the default', () => {
    expect(audioModelFor('text_to_speech', 'nope')).toBe('eleven_multilingual_v2');
    expect(isWiroAudioModel('eleven_v3')).toBe(false);
  });
});
