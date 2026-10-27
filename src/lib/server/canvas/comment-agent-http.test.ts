import { describe, expect, it, vi } from 'vitest';
import { httpAgent } from './comment-agent-http';

const link = { origin: 'https://feega.test', token: 'jwt' };
const job = { prompt: 'make it darker', nodeIds: ['n1'], canvasId: 'c', projectId: 'p' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('the comment agent over the project agent route', () => {
  it('sends the prompt with the selection and the commenter token, then reads the last answer', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('stream'))
      .mockResolvedValueOnce(json({ messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'Done.' }, { role: 'user', content: 'x' }] }));

    const answer = await httpAgent(link, fetcher)(job);

    expect(answer).toEqual({ ok: true, text: 'Done.' });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://feega.test/api/v1/projects/p/agent');
    expect(init.headers.authorization).toBe('Bearer jwt');
    expect(JSON.parse(init.body)).toEqual({ message: 'make it darker', canvasId: 'c', selection: ['n1'] });
  });

  it('a refused turn carries the reason, and nothing else is fetched', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ error: 'insufficient_credits' }, 402));

    const answer = await httpAgent(link, fetcher)(job);

    expect(answer).toEqual({ ok: false, message: 'insufficient_credits' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a turn that left no answer is a failure, not an empty reply', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('stream')).mockResolvedValueOnce(json({ messages: [] }));

    expect(await httpAgent(link, fetcher)(job)).toEqual({ ok: false, message: 'no_answer' });
  });
});
