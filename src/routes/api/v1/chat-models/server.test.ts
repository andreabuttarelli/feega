import { describe, it, expect, vi, beforeEach } from 'vitest';

const CATALOGUE = {
  data: [
    {
      id: 'anthropic/claude-opus-5.5',
      name: 'Anthropic: Claude Opus 5.5',
      supported_parameters: ['tools', 'reasoning'],
      reasoning: { supported_efforts: ['high', 'medium', 'low'], default_effort: 'high' },
      pricing: { prompt: '0.000002', completion: '0.00001' }
    },
    {
      id: 'z-ai/glm-5.3-flash',
      name: 'Z.ai: GLM 5.3 Flash',
      supported_parameters: ['tools', 'reasoning'],
      reasoning: { supported_efforts: ['max', 'high', 'low'], default_effort: 'max' },
      pricing: { prompt: '0.00000015', completion: '0.0000005' }
    }
  ]
};

vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => CATALOGUE })));
vi.mock('$env/dynamic/private', () => ({ env: { LLM_BASE_URL: 'https://openrouter.ai/api/v1' } }));

const { GET, PUT } = await import('./+server');
const { __resetGatewayModels } = await import('$lib/server/openrouter-models');

type Meta = Record<string, unknown>;

function event(meta: Meta, body?: unknown, cachedMeta: Meta = {}) {
  const updateUser = vi.fn(async (_attrs: { data: Meta }) => ({ error: null }));
  const user = { id: 'u-1', user_metadata: cachedMeta };
  const getUser = async () => ({ data: { user: { id: 'u-1', user_metadata: meta } }, error: null });
  return {
    updateUser,
    ev: {
      request: new Request('http://x/api/v1/chat-models', { method: body ? 'PUT' : 'GET', body: body ? JSON.stringify(body) : undefined }),
      locals: { safeGetSession: async () => ({ session: {}, user }), supabase: { auth: { updateUser, getUser } } }
    } as never
  };
}

beforeEach(() => __resetGatewayModels());

describe('chat model picker endpoint', () => {
  it('offers the catalogue grouped by provider, with the default when nothing is saved', async () => {
    const res = await GET(event({}).ev);
    const body = await res.json();
    expect(body.groups.map((g: { provider: string }) => g.provider)).toEqual(['anthropic', 'z-ai']);
    expect(body.choice).toEqual({ model: 'anthropic/claude-opus-5.5', reasoning: 'low' });
  });

  it('returns the saved choice', async () => {
    const res = await GET(event({ chat_model: { model: 'z-ai/glm-5.3-flash', reasoning: 'low' } }).ev);
    expect((await res.json()).choice).toEqual({ model: 'z-ai/glm-5.3-flash', reasoning: 'low' });
  });

  it('reads the saved choice fresh, not from the session cached before the last save', async () => {
    const res = await GET(event({ chat_model: { model: 'z-ai/glm-5.3-flash', reasoning: 'low' } }, undefined, {}).ev);
    expect((await res.json()).choice).toEqual({ model: 'z-ai/glm-5.3-flash', reasoning: 'low' });
  });

  it('a saved choice the catalogue no longer offers falls back to the default', async () => {
    const res = await GET(event({ chat_model: { model: 'gone/model', reasoning: 'low' } }).ev);
    expect((await res.json()).choice).toEqual({ model: 'anthropic/claude-opus-5.5', reasoning: 'low' });
  });

  it('saves a valid choice on the user', async () => {
    const { ev, updateUser } = event({}, { model: 'z-ai/glm-5.3-flash', reasoning: 'high' });
    const res = await PUT(ev);
    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ data: { chat_model: { model: 'z-ai/glm-5.3-flash', reasoning: 'high' } } });
  });

  it('refuses to save what the catalogue does not allow', async () => {
    const { ev, updateUser } = event({}, { model: 'z-ai/glm-5.3-flash', reasoning: 'medium' });
    const res = await PUT(ev);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unsupported_reasoning' });
    expect(updateUser).not.toHaveBeenCalled();
  });
});
