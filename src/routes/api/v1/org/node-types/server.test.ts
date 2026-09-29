import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveOrgCaller = vi.fn();
const canvasModelCatalogue = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));
vi.mock('$lib/server/elevenlabs-config', () => ({
  configuredAudioProvider: () => ({ voices: async () => [{ id: 'v1', name: 'Rachel', previewUrl: null, category: null, labels: {} }] })
}));
vi.mock('$lib/server/canvas-catalogue', () => ({
  canvasModelCatalogue: (...args: unknown[]) => canvasModelCatalogue(...args)
}));

import { GET } from './+server';

const WHY = '$0.040/image · released 2026-09';
const REC = (id: string) => ({ tier: 'balanced', id, label: id, unitCostUsd: 0.04, releasedAt: '2026-09-01T00:00:00Z', why: WHY });

function call(query = '') {
  const url = new URL(`https://feega.test/api/v1/org/node-types${query}`);
  return (GET as (event: unknown) => Promise<Response>)({
    request: new Request(url, { headers: { authorization: 'Bearer token' } }),
    url
  }).then(async (res) => ({ res, body: await res.json() }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1' } });
  canvasModelCatalogue.mockResolvedValue({
    text: { recommended: [REC('t')], candidates: [] },
    image: { recommended: [REC('i')], candidates: [] },
    video: { recommended: [], candidates: [] },
    audio: { recommended: [], candidates: [] }
  });
});

describe('GET /api/v1/org/node-types', () => {
  it('lists the recommended models per medium, each with a one-line why', async () => {
    const { res, body } = await call();

    expect(res.status).toBe(200);
    expect(body.recommended_models).toEqual({
      text: [{ tier: 'balanced', id: 't', label: 't', why: WHY }],
      image: [{ tier: 'balanced', id: 'i', label: 'i', why: WHY }],
      video: [],
      audio: []
    });
    expect(body.types).toBeTruthy();
  });

  it('describes every audio operation: inputs, default model, price unit', async () => {
    const { body } = await call('?type=audio');

    expect(Object.keys(body.types)).toEqual(['audio']);
    expect(body.audio_operations.text_to_speech).toMatchObject({
      source: 'text',
      needs_voice: true,
      default_model: 'eleven_multilingual_v2',
      billed_per: 'character'
    });
    expect(body.voices).toEqual([{ id: 'v1', name: 'Rachel', previewUrl: null, category: null, labels: {} }]);
    expect(body.audio_operations.dubbing).toMatchObject({ source: 'media', delivery: 'job', needs_language: true });
  });

  it('keeps the recommendations when asking for one type', async () => {
    const { body } = await call('?type=image');

    expect(Object.keys(body.types)).toEqual(['image']);
    expect(body.recommended_models.image[0].id).toBe('i');
  });
});
