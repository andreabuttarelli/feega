import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticate, loadBrandForUser, gateAiAction, enhancePrompt, screenModelInput } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  loadBrandForUser: vi.fn(),
  gateAiAction: vi.fn(),
  enhancePrompt: vi.fn(),
  screenModelInput: vi.fn()
}));
vi.mock('$lib/server/cli-auth', () => ({ authenticate, loadBrandForUser, gateAiAction }));
vi.mock('$lib/server/prompt-enhance', () => ({ enhancePrompt }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput }));

import { POST } from './+server';

const BLOCKED = "This prompt was blocked: violence and gore aren't allowed in feega's standard mode.";

function call(body: unknown) {
  return (POST as (event: unknown) => Promise<Response>)({
    request: new Request('https://feega.test/api/v1/brands/acme/prompts/enhance', { method: 'POST', body: JSON.stringify(body) }),
    params: { slug: 'acme' }
  }).then(async (res) => ({ res, body: await res.json() }));
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticate.mockResolvedValue({ supabase: {}, user: { id: 'user-1' } });
  loadBrandForUser.mockResolvedValue({ brand: { id: 'brand-1', org_id: 'org-1', name: 'Acme', slug: 'acme' } });
  gateAiAction.mockResolvedValue(null);
  enhancePrompt.mockResolvedValue({ prompt: 'better', model: 'm', changed: true, notes: [] });
  screenModelInput.mockResolvedValue({ ok: true });
});

describe('the brand enhance_prompt screens the brief before the enhancer sees it', () => {
  it('refuses a gory brief and never calls the enhancer', async () => {
    screenModelInput.mockResolvedValue({ ok: false, error: BLOCKED });

    const { res, body } = await call({ prompt: 'a decapitated body', model: 'm' });

    expect(res.status).toBe(422);
    expect(body).toEqual({ error: BLOCKED, code: 'prompt_blocked' });
    expect(enhancePrompt).not.toHaveBeenCalled();
    expect(screenModelInput.mock.calls[0][1]).toMatchObject({ profile: 'standard', scope: { orgId: 'org-1', userId: 'user-1' } });
  });

  it('enhances a clean brief', async () => {
    expect((await call({ prompt: 'a lighthouse at dusk', model: 'm' })).res.status).toBe(200);
    expect(enhancePrompt).toHaveBeenCalledOnce();
  });
});
