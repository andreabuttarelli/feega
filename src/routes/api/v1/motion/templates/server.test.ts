import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: {}, orgId: 'org-1', userId: 'u-1', writeAllowed: true } }) }));
vi.mock('$lib/server/repos/motion-templates', () => ({ listOrgTemplates: async () => [] }));

const { GET } = await import('./+server');

const list = async () => {
  const url = new URL('https://feega.app/api/v1/motion/templates');
  const res = await GET({ request: new Request(url, { headers: { authorization: 'Bearer k' } }), url } as never);
  return (await res.json()) as { templates: { id: string; card?: { roles: string[]; onScreen: string[] } }[] };
};

describe('GET /api/v1/motion/templates', () => {
  it('every built-in template comes with its card, so an outside agent plans sections the way the chat does', async () => {
    const { templates } = await list();
    const globe = templates.find((t) => t.id === 'builtin:image-globe');

    expect(templates.every((t) => t.card)).toBe(true);
    expect(globe?.card?.onScreen[0]).toMatch(/^0–2s pictures assemble/);
  });
});
