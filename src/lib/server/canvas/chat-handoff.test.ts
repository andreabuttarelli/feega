import { describe, expect, it, vi } from 'vitest';

const loadAttachments = vi.fn(async (_db: unknown, input: { ids: string[] }) => input.ids.map((id) => ({ assetId: id, kind: 'image', name: `${id}.png`, mimeType: 'image/png', bytes: 1 })));
vi.mock('$lib/server/chat-attachments/register', () => ({ loadAttachments }));

const { chatHandoff } = await import('./chat-handoff');

const SCOPE = { orgId: 'org-a', projectId: 'p1' };

describe('the canvas page takes the prompt the home handed it', () => {
  it('returns the words and the attachments the project owns, for the chat to send once', async () => {
    const handoff = await chatHandoff({} as never, SCOPE, new URL('http://x/p/p1/c/c1?prompt=a+launch+poster+series&attach=a1'));

    expect(loadAttachments).toHaveBeenCalledWith({}, { ...SCOPE, ids: ['a1'] });
    expect(handoff).toMatchObject({ text: 'a launch poster series', attachments: [{ assetId: 'a1' }] });
  });

  it('a canvas opened plainly has nothing to hand off and reads no attachments', async () => {
    loadAttachments.mockClear();

    expect(await chatHandoff({} as never, SCOPE, new URL('http://x/p/p1/c/c1'))).toBeNull();
    expect(loadAttachments).not.toHaveBeenCalled();
  });
});
