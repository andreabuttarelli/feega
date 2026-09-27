import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/tool-guard', () => ({
  ARCHIVE_USER_AGENT: 'test-agent',
  safeFetchBytes: vi.fn()
}));

import { safeFetchBytes } from '$lib/server/tool-guard';
import { archiveImageToBucket } from './media-archive';

const upload = vi.fn();
const supabase = { storage: { from: vi.fn(() => ({ upload })) } } as never;

beforeEach(() => {
  vi.clearAllMocks();
  upload.mockResolvedValue({ error: null });
});

describe('archiveImageToBucket', () => {
  it('usa brand-knowledge di default quando nessun bucket è passato', async () => {
    (safeFetchBytes as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      mime: 'image/jpeg',
      bytes: new Uint8Array([1])
    });

    await archiveImageToBucket(supabase, 'a/b.jpg', 'https://cdn.example.com/x.jpg');

    expect((supabase as { storage: { from: ReturnType<typeof vi.fn> } }).storage.from).toHaveBeenCalledWith('brand-knowledge');
  });

  it('scrive nel bucket passato esplicitamente', async () => {
    (safeFetchBytes as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      mime: 'image/jpeg',
      bytes: new Uint8Array([1])
    });

    await archiveImageToBucket(supabase, 'a/b.jpg', 'https://cdn.example.com/x.jpg', 'canvas-assets');

    expect((supabase as { storage: { from: ReturnType<typeof vi.fn> } }).storage.from).toHaveBeenCalledWith('canvas-assets');
  });

  it('torna null senza scrivere quando il download non è un\'immagine', async () => {
    (safeFetchBytes as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, mime: 'text/html', bytes: new Uint8Array([1]) });

    const out = await archiveImageToBucket(supabase, 'a/b.jpg', 'https://cdn.example.com/x.html', 'canvas-assets');

    expect(out).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });
});
