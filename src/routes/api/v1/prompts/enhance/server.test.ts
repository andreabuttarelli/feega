import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openOrgScope, enhancePrompt, screenModelInput } = vi.hoisted(() => ({
  openOrgScope: vi.fn(),
  enhancePrompt: vi.fn(),
  screenModelInput: vi.fn()
}));
vi.mock('$lib/server/cli-auth', () => ({ openOrgScope }));
vi.mock('$lib/server/prompt-enhance', () => ({ enhancePrompt }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput }));

import { POST } from './+server';

const BLOCKED = "This prompt was blocked: sexual content isn't allowed in feega's standard mode.";

function call(body: unknown) {
  return (POST as (event: unknown) => Promise<Response>)({
    request: new Request('https://feega.test/api/v1/prompts/enhance', { method: 'POST', body: JSON.stringify(body) })
  }).then(async (res) => ({ res, body: await res.json() }));
}

beforeEach(() => {
  vi.clearAllMocks();
  openOrgScope.mockResolvedValue({ scope: { supabase: {}, user: { id: 'user-1' }, orgId: 'org-1', organization: { id: 'org-1', name: 'Acme' } } });
  enhancePrompt.mockResolvedValue({ prompt: 'better', model: 'm', changed: true, notes: [] });
  screenModelInput.mockResolvedValue({ ok: true });
});

describe('enhance_prompt screens the brief before the enhancer sees it', () => {
  it('refuses a sexual brief with the category message and never calls the enhancer', async () => {
    screenModelInput.mockResolvedValue({ ok: false, error: BLOCKED });

    const { res, body } = await call({ prompt: 'a nude woman on a bed', model: 'm' });

    expect(res.status).toBe(422);
    expect(body).toEqual({ error: BLOCKED, code: 'prompt_blocked' });
    expect(enhancePrompt).not.toHaveBeenCalled();
    expect(screenModelInput).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ profile: 'standard', texts: ['a nude woman on a bed'], scope: expect.objectContaining({ orgId: 'org-1', userId: 'user-1' }) })
    );
  });

  it('enhances a clean brief', async () => {
    const { res } = await call({ prompt: 'a lighthouse at dusk', model: 'm' });
    expect(res.status).toBe(200);
    expect(enhancePrompt).toHaveBeenCalledOnce();
  });
});
