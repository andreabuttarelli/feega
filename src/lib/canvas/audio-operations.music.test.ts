import { describe, expect, it } from 'vitest';
import { AUDIO_OPERATION_IDS, audioOperationIdsFor } from './audio-operations';

describe('the audio operations a user can choose', () => {
  it('leave music out while it is off', () => {
    expect(audioOperationIdsFor(false)).not.toContain('music');
    expect(audioOperationIdsFor(false)).toContain('sound_effects');
    expect(audioOperationIdsFor(false)).toContain('text_to_speech');
  });

  it('list every operation when music is on', () => {
    expect(audioOperationIdsFor(true)).toEqual(AUDIO_OPERATION_IDS);
  });
});
