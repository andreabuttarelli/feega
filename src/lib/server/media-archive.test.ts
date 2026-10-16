import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/tool-guard', () => ({
  ARCHIVE_USER_AGENT: 'test-agent',
  safeFetchBytes: vi.fn()
}));

import { safeFetchBytes } from '$lib/server/tool-guard';
import { archiveImageToBucket, archiveVideoToBucket } from './media-archive';

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

describe('archiveVideoToBucket', () => {
  it('stores a video, with a larger byte cap than an image', async () => {
    (safeFetchBytes as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, mime: 'video/mp4', bytes: new Uint8Array([1]) });

    const out = await archiveVideoToBucket(supabase, 'a/b.mp4', 'https://cdn.example.com/x.mp4', 'canvas-assets');

    expect(out).toBe('a/b.mp4');
    expect(upload).toHaveBeenCalledWith('a/b.mp4', expect.any(Uint8Array), { contentType: 'video/mp4', upsert: true });
    const [, options] = (safeFetchBytes as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.maxBytes).toBeGreaterThan(5 * 1024 * 1024);
  });

  it('refuses an image where a video was expected', async () => {
    (safeFetchBytes as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, mime: 'image/jpeg', bytes: new Uint8Array([1]) });

    expect(await archiveVideoToBucket(supabase, 'a/b.mp4', 'https://cdn.example.com/x.jpg', 'canvas-assets')).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });
});
