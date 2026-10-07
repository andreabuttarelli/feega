import { describe, expect, it } from 'vitest';
import { micProblemOf, MIC_PROBLEM_MESSAGE, recorderMime, recordingReady } from './voice-recording';
import { CLONE_MIN_SECONDS, CLONE_MAX_SECONDS } from './voices';

describe('the recorder format', () => {
  it('prefers webm/opus, falls back to mp4 for Safari, else lets the browser pick', () => {
    expect(recorderMime(() => true)).toBe('audio/webm;codecs=opus');
    expect(recorderMime((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(recorderMime(() => false)).toBe('');
  });
});

describe('microphone problems', () => {
  it('say what to do when permission is denied, missing, or the browser cannot record', () => {
    expect(micProblemOf({ name: 'NotAllowedError' })).toBe('denied');
    expect(micProblemOf({ name: 'NotFoundError' })).toBe('no_microphone');
    expect(micProblemOf({ name: 'Weird' })).toBe('unavailable');
    expect(micProblemOf(null, { hasMediaDevices: false })).toBe('unsupported');
    expect(MIC_PROBLEM_MESSAGE.denied).toMatch(/settings/i);
  });
});

describe('a recording is ready to clone', () => {
  it('only between the minimum and the maximum length', () => {
    expect(recordingReady(CLONE_MIN_SECONDS - 0.5)).toBe(false);
    expect(recordingReady(CLONE_MIN_SECONDS)).toBe(true);
    expect(recordingReady(CLONE_MAX_SECONDS + 1)).toBe(false);
  });
});
