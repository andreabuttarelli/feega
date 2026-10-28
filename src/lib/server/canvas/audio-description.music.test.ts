import { describe, expect, it, vi } from 'vitest';

const world = vi.hoisted(() => ({ music: false }));
vi.mock('$lib/server/elevenlabs-music', () => ({ musicEnabled: () => world.music }));
vi.mock('$lib/server/elevenlabs-config', () => ({ configuredAudioProvider: () => null }));

import { audioOperations } from './audio-description';

describe('the audio operations an agent is told about', () => {
  it('omit music while it is off', () => {
    world.music = false;
    expect(Object.keys(audioOperations())).not.toContain('music');
  });

  it('include music when it is on', () => {
    world.music = true;
    expect(Object.keys(audioOperations())).toContain('music');
  });
});
