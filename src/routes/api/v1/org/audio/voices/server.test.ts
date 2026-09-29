import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveOrgCaller = vi.fn();
const configuredAudioProvider = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));
vi.mock('$lib/server/elevenlabs-config', () => ({
  configuredAudioProvider: () => configuredAudioProvider()
}));

import { GET } from './+server';

const RACHEL = { id: 'v1', name: 'Rachel', previewUrl: 'https://p/1.mp3', category: 'premade', labels: {} };

function call() {
  const url = new URL('https://feega.test/api/v1/org/audio/voices');
  return (GET as (event: unknown) => Promise<Response>)({
    request: new Request(url, { headers: { authorization: 'Bearer token' } }),
    url
  }).then(async (res) => ({ res, body: await res.json() }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1' } });
});

describe('GET /api/v1/org/audio/voices', () => {
  it('lists the ElevenLabs voices an audio node can use', async () => {
    configuredAudioProvider.mockReturnValue({ voices: async () => [RACHEL] });

    const { res, body } = await call();

    expect(res.status).toBe(200);
    expect(body.voices).toEqual([RACHEL]);
  });

  it('says the provider is not configured instead of an empty list', async () => {
    configuredAudioProvider.mockReturnValue(null);

    const { res, body } = await call();

    expect(res.status).toBe(503);
    expect(body.error).toBe('elevenlabs_not_configured');
  });
});
