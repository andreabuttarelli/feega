import { describe, expect, it } from 'vitest';
import { AttachmentError, CHAT_ATTACHMENT_MAX_COUNT } from '$lib/chat-attachments';
import { ChatUploads, UploadStatus, type UploadPorts } from './chat-uploads.svelte';

const file = (name: string, type: string, size = 4) => new File([new Uint8Array(size)], name, { type });

function ports(over: Partial<UploadPorts> = {}): UploadPorts & { puts: string[] } {
  const puts: string[] = [];
  return {
    puts,
    fetch: (async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (url.endsWith('/sign')) {
        return new Response(JSON.stringify({ path: `o/p/chat/u__${body.name}`, uploadUrl: `https://up/${body.name}` }));
      }
      return new Response(JSON.stringify({ attachment: { assetId: `id-${body.path}`, kind: 'image', name: 'x', mimeType: body.mimeType, bytes: 4 } }));
    }) as typeof fetch,
    put: async (url, _file, progress) => {
      puts.push(url);
      progress(0.5);
      progress(1);
    },
    preview: () => 'blob:preview',
    ...over
  };
}

const settle = async () => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

describe('ChatUploads', () => {
  it('carica, firma e registra: l\'allegato è pronto con l\'asset id', async () => {
    const p = ports();
    const uploads = new ChatUploads('p-1', p);

    uploads.add([file('logo.png', 'image/png')]);
    expect(uploads.items[0]).toMatchObject({ name: 'logo.png', status: UploadStatus.Uploading, preview: 'blob:preview' });
    expect(uploads.busy).toBe(true);
    await settle();

    expect(p.puts).toEqual(['https://up/logo.png']);
    expect(uploads.items[0]).toMatchObject({ status: UploadStatus.Ready, progress: 1 });
    expect(uploads.ready.map((a) => a.assetId)).toEqual(['id-o/p/chat/u__logo.png']);
    expect(uploads.busy).toBe(false);
  });

  it('un formato fuori lista non parte e dice perché', async () => {
    const p = ports();
    const uploads = new ChatUploads('p-1', p);

    uploads.add([file('clip.mp4', 'video/mp4')]);
    await settle();

    expect(uploads.items[0]).toMatchObject({ status: UploadStatus.Failed, error: AttachmentError.Unsupported });
    expect(p.puts).toEqual([]);
  });

  it('oltre dieci per messaggio, i file in più sono rifiutati', async () => {
    const uploads = new ChatUploads('p-1', ports());

    uploads.add(Array.from({ length: CHAT_ATTACHMENT_MAX_COUNT + 2 }, (_, i) => file(`f${i}.txt`, 'text/plain')));
    await settle();

    expect(uploads.items.filter((u) => u.status === UploadStatus.Ready)).toHaveLength(CHAT_ATTACHMENT_MAX_COUNT);
    expect(uploads.items.filter((u) => u.error === AttachmentError.TooMany)).toHaveLength(2);
  });

  it('il rifiuto del server (moderazione) arriva sul chip con il suo testo', async () => {
    const refusing = ports({
      fetch: (async (url: string) =>
        url.endsWith('/sign')
          ? new Response(JSON.stringify({ path: 'o/p/chat/u__f.png', uploadUrl: 'https://up/f' }))
          : new Response(JSON.stringify({ error: 'Refused: people', code: AttachmentError.Refused }), { status: 422 })) as typeof fetch
    });
    const uploads = new ChatUploads('p-1', refusing);

    uploads.add([file('face.png', 'image/png')]);
    await settle();

    expect(uploads.items[0]).toMatchObject({ status: UploadStatus.Failed, error: AttachmentError.Refused, detail: 'Refused: people' });
    expect(uploads.ready).toEqual([]);
  });

  it('remove e clear tolgono i chip', async () => {
    const uploads = new ChatUploads('p-1', ports());
    uploads.add([file('a.png', 'image/png'), file('b.md', 'text/markdown')]);
    await settle();

    uploads.remove(uploads.items[0].id);
    expect(uploads.items.map((u) => u.name)).toEqual(['b.md']);
    uploads.clear();
    expect(uploads.items).toEqual([]);
  });
});
