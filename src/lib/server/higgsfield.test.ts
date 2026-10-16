import { describe, expect, it, vi } from 'vitest';
import { higgsfield, higgsfieldEstimate, higgsfieldOptions } from './higgsfield';
import { ProviderBusyError } from './canvas/task-provider';
import { HF_CONCURRENCY_REACHED, HF_ESTIMATE, HF_RESTYLE_PRESETS, HF_FAILED, HF_IMAGE_DONE, HF_IN_PROGRESS, HF_NSFW, HF_QUEUED, HF_REQUEST_ID, HF_UNAUTHORIZED, HF_VIDEO_DONE } from './higgsfield.fixtures';

const CREDENTIALS = { keyId: 'id', keySecret: 'secret' };

function replying(...replies: Array<{ status?: number; body?: unknown }>) {
  const fetchFn = vi.fn();
  for (const reply of replies) {
    fetchFn.mockResolvedValueOnce(new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status ?? 200 }));
  }
  return { gateway: higgsfield({ ...CREDENTIALS, fetchFn: fetchFn as unknown as typeof fetch }), fetchFn };
}

describe('higgsfield adapter — submit', () => {
  it('posts the body to the model path with the key pair and an idempotency key', async () => {
    const { gateway, fetchFn } = replying({ body: HF_QUEUED });

    const out = await gateway.run({ path: 'kling-video/v2.5-turbo/pro/text-to-video', numeric: ['duration'] }, { prompt: 'a lake', duration: '5' }, 'run-1');

    expect(out).toEqual({ taskId: HF_REQUEST_ID });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.higgsfield.ai/kling-video/v2.5-turbo/pro/text-to-video');
    expect(init.headers).toMatchObject({ Authorization: 'Key id:secret', 'Idempotency-Key': 'run-1' });
    expect(JSON.parse(init.body)).toEqual({ prompt: 'a lake', duration: 5 });
  });

  it('surfaces the FastAPI detail of a refused submit', async () => {
    const { gateway } = replying({ status: 401, body: HF_UNAUTHORIZED });

    await expect(gateway.run({ path: 'higgsfield-ai/soul/standard' }, { prompt: 'x' })).rejects.toThrow(/higgsfield_failed: HTTP 401 Invalid credentials/);
  });
});

describe('higgsfield adapter — concurrency', () => {
  it('reads the 400 for a full account as busy, not as a failed generation', async () => {
    const { gateway } = replying({ status: 400, body: HF_CONCURRENCY_REACHED });

    await expect(gateway.run({ path: 'higgsfield-ai/soul/standard' }, { prompt: 'x' })).rejects.toBeInstanceOf(ProviderBusyError);
  });

  it('keeps any other 400 a failure', async () => {
    const { gateway } = replying({ status: 400, body: { detail: 'prompt too long' } });

    await expect(gateway.run({ path: 'higgsfield-ai/soul/standard' }, { prompt: 'x' })).rejects.not.toBeInstanceOf(ProviderBusyError);
  });
});

describe('higgsfield adapter — status', () => {
  it('reads queued and in_progress as pending', async () => {
    const { gateway, fetchFn } = replying({ body: HF_QUEUED }, { body: HF_IN_PROGRESS });

    expect(await gateway.task(HF_REQUEST_ID)).toEqual({ state: 'pending' });
    expect(await gateway.task(HF_REQUEST_ID)).toEqual({ state: 'pending' });
    expect(fetchFn.mock.calls[0][0]).toBe(`https://api.higgsfield.ai/requests/${HF_REQUEST_ID}/status`);
  });

  it('reads a finished image and a finished video; status carries no cost, the catalogue quote bills', async () => {
    const { gateway } = replying({ body: HF_IMAGE_DONE }, { body: HF_VIDEO_DONE });

    expect(await gateway.task(HF_REQUEST_ID)).toEqual({ state: 'done', outputs: [{ url: 'https://cdn.higgsfield.ai/out/abc.png', contentType: 'image/png' }], costUsd: null });
    expect(await gateway.task(HF_REQUEST_ID)).toEqual({ state: 'done', outputs: [{ url: 'https://cdn.higgsfield.ai/out/abc.mp4', contentType: 'video/mp4' }], costUsd: null });
  });

  it('reads failed and nsfw as failures, which Higgsfield does not charge', async () => {
    const { gateway } = replying({ body: HF_FAILED }, { body: HF_NSFW });

    expect(await gateway.task(HF_REQUEST_ID)).toEqual({ state: 'failed', error: 'higgsfield_failed: Generation failed' });
    expect(await gateway.task(HF_REQUEST_ID)).toEqual({ state: 'failed', error: 'higgsfield_nsfw: rejected by moderation' });
  });
});

describe('higgsfield adapter — cancel', () => {
  it('cancels a queued request (202) and reports a started one (400) as not cancelled', async () => {
    const { gateway } = replying({ status: 202 }, { status: 400, body: { detail: 'already started' } });

    expect(await gateway.cancel!(HF_REQUEST_ID)).toBe(true);
    expect(await gateway.cancel!(HF_REQUEST_ID)).toBe(false);
  });
});

describe('higgsfield estimate — the price source', () => {
  it('reads the usd string of /estimate as a number', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify(HF_ESTIMATE)));

    expect(await higgsfieldEstimate({ ...CREDENTIALS, fetchFn: fetchFn as unknown as typeof fetch }, 'higgsfield-ai/soul/standard', { prompt: 'x' })).toBe(0.094);
    expect(fetchFn.mock.calls[0][0]).toBe('https://api.higgsfield.ai/estimate/higgsfield-ai/soul/standard');
  });
});

describe('higgsfield adapter — quote', () => {
  it('prices the exact request body through /estimate', async () => {
    const { gateway, fetchFn } = replying({ body: HF_ESTIMATE });

    const usd = await gateway.quote({ path: 'higgsfield/genjutsu/restyle/v1.0', numeric: ['duration'] }, { video_url: 'https://cdn.test/v.mp4', resolution: '1080p' });

    expect(usd).toBe(0.094);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.higgsfield.ai/estimate/higgsfield/genjutsu/restyle/v1.0');
    expect(JSON.parse(init.body)).toEqual({ video_url: 'https://cdn.test/v.mp4', resolution: '1080p' });
  });
});

describe('higgsfield adapter — presets', () => {
  it('reads the selectable restyle presets as id and name', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify(HF_RESTYLE_PRESETS)));

    const presets = await higgsfieldOptions({ ...CREDENTIALS, fetchFn: fetchFn as unknown as typeof fetch }, 'models/higgsfield/genjutsu/restyle/v1.0/presets');

    expect(presets).toEqual(HF_RESTYLE_PRESETS.items.map(({ id, name }) => ({ id, name })));
    expect(fetchFn.mock.calls[0][0]).toBe('https://api.higgsfield.ai/models/higgsfield/genjutsu/restyle/v1.0/presets');
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ method: 'GET', headers: { Authorization: 'Key id:secret' } });
  });
});

