import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_FEEGA_LOCAL: '1' } }));

const { revalidated } = await import('./revalidated');

const body = JSON.stringify({ frames: { a: 'x'.repeat(10_000) } });

describe('a frame source response in local mode', () => {
  it('goes out plain even when the browser accepts brotli: on loopback, compressing only spends the one server thread', async () => {
    const res = revalidated(new Request('http://127.0.0.1/sources', { headers: { 'accept-encoding': 'gzip, deflate, br' } }), body);

    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe(body);
  });
});
