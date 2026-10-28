import { describe, expect, it, vi } from 'vitest';

const world = vi.hoisted(() => ({ music: false }));
vi.mock('$lib/server/elevenlabs-music', async (original) => ({ ...(await original<object>()), musicEnabled: () => world.music, musicRefusalFor: (op: string) => (op === 'music' && !world.music ? 'music_unavailable' : null) }));
vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn() }));

import { runAudio } from './audio-run';

const compose = vi.fn();
const provider = { compose } as never;
const req = { scope: { orgId: 'o', projectId: 'p', nodeId: 'n', userId: 'u' }, operation: 'music', model: 'music_v1', params: { operation: 'music', duration: 10 }, text: 'a bed', audioUrls: [], videoUrls: [] } as never;

describe('running a music node', () => {
  it('is refused upfront while music is off, without calling the provider', async () => {
    world.music = false;
    const out = await runAudio({} as never, provider, req);
    expect(out).toMatchObject({ kind: 'refused' });
    expect(compose).not.toHaveBeenCalled();
  });
});
