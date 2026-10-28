import { describe, expect, it, vi } from 'vitest';

const world = vi.hoisted(() => ({ music: false }));
vi.mock('$lib/server/elevenlabs-music', () => ({ musicEnabled: () => world.music }));

import { EDITOR_OP_SUMMARIES } from './editor-op-summaries';

describe('the generate_sound summary an agent reads', () => {
  it('does not offer music while it is off', () => {
    world.music = false;
    expect(EDITOR_OP_SUMMARIES.generate_sound).not.toMatch(/music/);
  });

  it('offers music when it is on', () => {
    world.music = true;
    expect(EDITOR_OP_SUMMARIES.generate_sound).toMatch(/sound:"music"/);
  });
});
