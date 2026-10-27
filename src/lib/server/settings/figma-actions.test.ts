import { describe, expect, it, vi, beforeEach } from 'vitest';

const store = { read: vi.fn(), save: vi.fn(), remove: vi.fn() };
vi.mock('$lib/server/figma/token-store', () => ({ figmaTokenStore: () => store }));

const { saveFigmaToken, testFigmaToken, removeFigmaToken, hasFigmaToken } = await import('./figma-actions');

const locals = (user: { id: string } | null = { id: 'u1' }) => ({ supabase: {}, safeGetSession: async () => ({ user }) });
const post = (fields: Record<string, string>, user?: { id: string } | null) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.set(k, v));
  return { request: new Request('https://feega.app', { method: 'POST', body: form }), locals: locals(user) } as never;
};

beforeEach(() => {
  vi.restoreAllMocks();
  store.read.mockReset();
  store.save.mockReset().mockResolvedValue(true);
  store.remove.mockReset();
});

describe('Figma token in settings', () => {
  it('saves the trimmed token and answers without it', async () => {
    const out = await saveFigmaToken(post({ token: '  figd_abc12345  ' }));

    expect(store.save).toHaveBeenCalledWith('figd_abc12345');
    expect(out).toEqual({ figmaSaved: true });
  });

  it('refuses an empty token', async () => {
    const out = await saveFigmaToken(post({ token: '   ' }));

    expect(store.save).not.toHaveBeenCalled();
    expect(out).toMatchObject({ status: 400, data: { figmaError: 'invalid' } });
  });

  it('says so when the table is not migrated yet', async () => {
    store.save.mockResolvedValue(false);

    expect(await saveFigmaToken(post({ token: 'figd_abc12345' }))).toMatchObject({ status: 503, data: { figmaError: 'unavailable' } });
  });

  it('tests the stored token against Figma /v1/me', async () => {
    store.read.mockResolvedValue('figd_abc12345');
    const figma = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ handle: 'ada' })));

    const out = await testFigmaToken(post({}));

    expect(figma).toHaveBeenCalledWith('https://api.figma.com/v1/me', { headers: { 'X-Figma-Token': 'figd_abc12345' } });
    expect(out).toEqual({ figmaTested: 'ada' });
  });

  it('a token Figma rejects fails the test', async () => {
    store.read.mockResolvedValue('figd_abc12345');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 403 }));

    expect(await testFigmaToken(post({}))).toMatchObject({ status: 422, data: { figmaError: 'rejected' } });
  });

  it('a token without the Current user scope still passes, with a note', async () => {
    store.read.mockResolvedValue('figd_abc12345');
    const err = 'Invalid scope(s): file_content:read. This endpoint requires the current_user:read scope';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 403, err }), { status: 403 }));

    expect(await testFigmaToken(post({}))).toEqual({ figmaTested: '', figmaNote: 'scope' });
  });

  it('testing without a stored token asks for one', async () => {
    store.read.mockResolvedValue(null);

    expect(await testFigmaToken(post({}))).toMatchObject({ status: 409, data: { figmaError: 'none' } });
  });

  it('removes the token', async () => {
    expect(await removeFigmaToken(post({}))).toEqual({ figmaRemoved: true });
    expect(store.remove).toHaveBeenCalled();
  });

  it('an anonymous caller is refused', async () => {
    expect(await saveFigmaToken(post({ token: 'figd_abc12345' }, null))).toMatchObject({ status: 401 });
  });

  it('knows whether a token is set without exposing it', async () => {
    store.read.mockResolvedValue('figd_abc12345');

    expect(await hasFigmaToken(locals() as never)).toBe(true);
    store.read.mockResolvedValue(null);
    expect(await hasFigmaToken(locals() as never)).toBe(false);
  });
});
