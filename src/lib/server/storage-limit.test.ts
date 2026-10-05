import { describe, expect, it, vi } from 'vitest';
import { probeUploadLimit } from './storage-limit';

const HTTP_TOO_LARGE = 413;
const HTTP_FORBIDDEN = 403;

function storageWithLimit(limit: number) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const length = Number((init.headers as Record<string, string>)['upload-length']);
    return new Response(null, { status: length > limit ? HTTP_TOO_LARGE : HTTP_FORBIDDEN });
  });
}

describe('probeUploadLimit', () => {
  it('finds the exact bytes a file may have, without uploading any', async () => {
    const fetcher = storageWithLimit(50 * 1024 * 1024);

    expect(await probeUploadLimit({ url: 'https://p.supabase.co', apiKey: 'anon', bucket: 'canvas-assets' }, fetcher)).toBe(50 * 1024 * 1024);
    expect(fetcher.mock.calls.every(([, init]) => init.method === 'POST' && !init.body)).toBe(true);
  });

  it('asks the resumable endpoint about the bucket the renders land in', async () => {
    const fetcher = storageWithLimit(5 * 1024 * 1024 * 1024);

    expect(await probeUploadLimit({ url: 'https://p.supabase.co', apiKey: 'anon', bucket: 'canvas-assets' }, fetcher)).toBe(5 * 1024 * 1024 * 1024);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://p.supabase.co/storage/v1/upload/resumable');
    expect((init.headers as Record<string, string>)['upload-metadata']).toContain(`bucketName ${btoa('canvas-assets')}`);
  });

  it('an answer that is neither a refusal for size nor for auth is not a limit', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 500 }));

    await expect(probeUploadLimit({ url: 'https://p.supabase.co', apiKey: 'anon', bucket: 'b' }, fetcher)).rejects.toThrow(/500/);
  });
});
