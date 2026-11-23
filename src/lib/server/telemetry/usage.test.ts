import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, MAX_EVENTS, handleUsage, type UsageRow, type UsageSink } from './usage';

const ID = '3f1c9a52-5b0e-4c1d-9a54-0d2f6f1e7a10';
const SESSION = '7d9e1c40-2b6a-4f43-8a2e-5c1b9d0e4f77';

const event = (over: Record<string, unknown> = {}) => ({
  event: 'session_start',
  install_id: ID,
  session_id: SESSION,
  ext_version: '0.2.9',
  editor: 'vscode',
  os: 'darwin',
  arch: 'arm64',
  device: 'desktop',
  ...over
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://oh.feega.app/api/v1/telemetry', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });

function recorder() {
  const rows: UsageRow[] = [];
  const sink: UsageSink = async (batch) => {
    rows.push(...batch);
  };
  return { rows, sink };
}

let clientCounter = 0;
const freshClient = () => `client-${clientCounter++}`;

describe('handleUsage', () => {
  it('stores a batch with the location read from the Vercel headers', async () => {
    const { rows, sink } = recorder();
    const res = await handleUsage(
      post({ events: [event(), event({ event: 'edit', edit_count: 1 })] }, { 'x-vercel-ip-country': 'IT', 'x-vercel-ip-country-region': 'MI', 'x-vercel-ip-city': 'Citt%C3%A0%20di%20Roma' }),
      freshClient(),
      sink
    );

    expect(res.status).toBe(204);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ country: 'IT', region: 'MI', city: 'Città di Roma', event: 'session_start', editor: 'vscode', os: 'darwin', device: 'desktop' });
  });

  it('keeps location null when the headers are absent', async () => {
    const { rows, sink } = recorder();
    await handleUsage(post({ events: [event()] }), freshClient(), sink);

    expect(rows[0]).toMatchObject({ country: null, region: null, city: null });
  });

  it('stores a session end with duration and edit count', async () => {
    const { rows, sink } = recorder();
    await handleUsage(post({ events: [event({ event: 'session_end', duration_ms: 90000, edit_count: 4 })] }), freshClient(), sink);

    expect(rows[0]).toMatchObject({ event: 'session_end', duration_ms: 90000, edit_count: 4 });
  });

  it('drops fields that are not in the schema, such as paths', async () => {
    const { rows, sink } = recorder();
    await handleUsage(post({ events: [event({ file: '/Users/me/app/page.tsx', ip: '1.2.3.4' })] }), freshClient(), sink);

    expect(Object.keys(rows[0])).not.toContain('file');
    expect(Object.keys(rows[0])).not.toContain('ip');
  });

  it.each([
    ['unknown event', { events: [event({ event: 'keystroke' })] }],
    ['unknown editor', { events: [event({ editor: 'emacs' })] }],
    ['bad install id', { events: [event({ install_id: 'abc' })] }],
    ['negative duration', { events: [event({ duration_ms: -1 })] }],
    ['empty batch', { events: [] }],
    ['too many events', { events: Array.from({ length: MAX_EVENTS + 1 }, () => event()) }],
    ['not json', 'nope']
  ])('rejects %s with 400 and stores nothing', async (_name, body) => {
    const { rows, sink } = recorder();
    const res = await handleUsage(post(body), freshClient(), sink);

    expect(res.status).toBe(400);
    expect(rows).toEqual([]);
  });

  it('rejects an oversized body with 413', async () => {
    const { rows, sink } = recorder();
    const res = await handleUsage(post(JSON.stringify({ events: [event()], pad: 'x'.repeat(MAX_BODY_BYTES) })), freshClient(), sink);

    expect(res.status).toBe(413);
    expect(rows).toEqual([]);
  });

  it('answers 429 once a client exceeds its quota', async () => {
    const { sink } = recorder();
    const client = freshClient();
    const statuses: number[] = [];
    for (let i = 0; i < 40; i++) {
      statuses.push((await handleUsage(post({ events: [event()] }), client, sink)).status);
    }

    expect(statuses).toContain(429);
    expect(statuses[0]).toBe(204);
  });

  it('a failing store never surfaces as an error to the client', async () => {
    const res = await handleUsage(post({ events: [event()] }), freshClient(), async () => {
      throw new Error('db down');
    });

    expect(res.status).toBe(204);
  });

  it('rejects an ext_version that is not semver', async () => {
    const { rows, sink } = recorder();
    const res = await handleUsage(post({ events: [event({ ext_version: '1' })] }), freshClient(), sink);

    expect(res.status).toBe(400);
    expect(rows).toEqual([]);
  });

  it('accepts a prerelease semver', async () => {
    const { rows, sink } = recorder();
    const res = await handleUsage(post({ events: [event({ ext_version: '0.2.14-rc.1' })] }), freshClient(), sink);

    expect(res.status).toBe(204);
    expect(rows).toHaveLength(1);
  });

  it('drops a batch from a client that declares CI', async () => {
    const { rows, sink } = recorder();
    const res = await handleUsage(post({ events: [event()] }, { 'x-feega-ci': '1' }), freshClient(), sink);

    expect(res.status).toBe(204);
    expect(rows).toEqual([]);
  });
});
