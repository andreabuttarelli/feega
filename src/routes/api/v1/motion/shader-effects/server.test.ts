import { describe, expect, it, vi } from 'vitest';
import { SHADER_EFFECT_IDS } from '$lib/motion/shader-effects/catalogue';

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args) }));

const { GET } = await import('./+server');

const call = () => {
  const url = new URL('https://feega.app/api/v1/motion/shader-effects');
  return GET({ request: new Request(url, { headers: { authorization: 'Bearer k' } }), url } as never);
};

describe('GET /api/v1/motion/shader-effects', () => {
  it('lists every effect add_shader_effect takes, with its knobs', async () => {
    resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1' } });

    const body = await (await call()).json();

    expect(body.effects.map((e: { id: string }) => e.id)).toEqual(SHADER_EFFECT_IDS);
    expect(body.effects.find((e: { id: string }) => e.id === 'iris-wipe')).toMatchObject({ category: 'transition', source: 'filter', live: false, knobs: { progress: { min: 0, max: 1, keyframes: true } } });
    expect(body.effects.find((e: { id: string }) => e.id === 'plasma').knobs.speed.keyframes).toBe(false);
    expect(body.effects.find((e: { id: string }) => e.id === 'chroma-flow').live).toBe(true);
  });

  it('refuses without a caller', async () => {
    resolveOrgCaller.mockResolvedValue({ error: { status: 401, body: { error: 'unauthorized' } } });

    expect((await call()).status).toBe(401);
  });
});
