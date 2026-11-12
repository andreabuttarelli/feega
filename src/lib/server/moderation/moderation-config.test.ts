import { describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { ModerationProfile } from './profiles';

const publicEnv = vi.hoisted(() => ({ value: {} as Record<string, string> }));

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$env/dynamic/public', () => ({
  env: new Proxy({}, { get: (_, key: string) => publicEnv.value[key] })
}));

const scope = { orgId: 'org', projectId: null, nodeId: null, userId: 'user', model: null, uncensored: false };

describe('the ports the moderator runs on', () => {
  it('are the local profile on the user own machine', async () => {
    publicEnv.value = { PUBLIC_FEEGA_LOCAL: '1' };
    const { moderationPorts } = await import('./moderation-config');
    expect(moderationPorts({} as Db, scope).profile).toBe(ModerationProfile.Local);
  });

  it('keep the carried profile in the cloud', async () => {
    publicEnv.value = {};
    const { moderationPorts } = await import('./moderation-config');
    expect(moderationPorts({} as Db, scope).profile).toBe(ModerationProfile.Standard);
    expect(moderationPorts({} as Db, { ...scope, uncensored: true }).profile).toBe(ModerationProfile.Uncensored);
  });
});
