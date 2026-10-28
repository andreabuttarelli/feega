import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock('@sentry/sveltekit', () => ({ captureMessage }));

const { POST } = await import('./+server');

const post = (body: string) => POST({ request: new Request('https://feega.test/api/v1/telemetry/crash', { method: 'POST', body }) } as never);

describe('a suspected canvas crash', () => {
  beforeEach(() => captureMessage.mockReset());

  it('reaches Sentry tagged, with the last sample attached', async () => {
    const res = await post(JSON.stringify({ zoom: 3.2, device: 'phone', textureBytes: 1024 }));

    expect(res.status).toBe(204);
    expect(captureMessage).toHaveBeenCalledWith('webcontent-crash-suspected', expect.objectContaining({ level: 'warning', tags: { kind: 'webcontent-crash-suspected', device: 'phone' }, extra: { zoom: 3.2, device: 'phone', textureBytes: 1024 } }));
  });

  it('keeps only flat numbers and short strings', async () => {
    await post(JSON.stringify({ zoom: 1, nested: { a: 1 }, long: 'x'.repeat(500) }));

    expect(captureMessage.mock.calls[0][1].extra).toEqual({ zoom: 1 });
  });

  it('refuses a body that is not a record', async () => {
    expect((await post('[1,2]')).status).toBe(400);
    expect((await post('nope')).status).toBe(400);
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('refuses an oversized body', async () => {
    expect((await post(JSON.stringify({ a: 'x'.repeat(20_000) }))).status).toBe(413);
  });
});
