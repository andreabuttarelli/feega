import { describe, expect, it, vi, beforeEach } from 'vitest';

const repo = { readAgentMemory: vi.fn(), saveAgentMemory: vi.fn() };
vi.mock('$lib/server/repos/profiles', () => repo);

const { MEMORY_MAX_CHARS } = await import('$lib/onboarding/limits');
const { readMemory, saveMemory } = await import('./memory-actions');

const locals = (user: { id: string } | null = { id: 'u1' }) => ({ supabase: {}, safeGetSession: async () => ({ user }) });
const post = (content: string, user?: { id: string } | null) => {
  const form = new FormData();
  form.set('content', content);
  return { request: new Request('https://feega.app', { method: 'POST', body: form }), locals: locals(user) } as never;
};

beforeEach(() => {
  repo.readAgentMemory.mockReset().mockResolvedValue('be terse');
  repo.saveAgentMemory.mockReset().mockResolvedValue(undefined);
});

describe('memory in settings', () => {
  it('shows what the chat knows about the user', async () => {
    expect(await readMemory(locals())).toBe('be terse');
    expect(repo.readAgentMemory).toHaveBeenCalledWith({}, 'u1');
  });

  it('saves the trimmed text for the signed-in user', async () => {
    expect(await saveMemory(post('  likes minimal type  '))).toEqual({ memorySaved: true });
    expect(repo.saveAgentMemory).toHaveBeenCalledWith({}, 'u1', 'likes minimal type');
  });

  it('stores plain line breaks, not the form\'s CRLF', async () => {
    await saveMemory(post('a\r\nb'));
    expect(repo.saveAgentMemory).toHaveBeenCalledWith({}, 'u1', 'a\nb');
  });

  it('clears the memory when the field is emptied', async () => {
    await saveMemory(post('   '));
    expect(repo.saveAgentMemory).toHaveBeenCalledWith({}, 'u1', '');
  });

  it('refuses text longer than the limit', async () => {
    expect(await saveMemory(post('x'.repeat(MEMORY_MAX_CHARS + 1)))).toMatchObject({ status: 413, data: { memoryError: 'too_long' } });
    expect(repo.saveAgentMemory).not.toHaveBeenCalled();
  });

  it('refuses a visitor without a session', async () => {
    expect(await saveMemory(post('hi', null))).toMatchObject({ status: 401 });
  });
});
