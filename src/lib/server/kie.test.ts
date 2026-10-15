import { describe, expect, it, vi } from 'vitest';
import { kie, KIE_CREDIT_USD } from './kie';
import { KIE_CREATED, KIE_EMPTY_RECORD, KIE_FAILED, KIE_REFUSED_IN_BODY, KIE_SUCCESS, KIE_WAITING } from './kie.fixtures';

function replying(...bodies: Array<{ status?: number; body: unknown }>) {
  const fetchFn = vi.fn();
  for (const reply of bodies) {
    fetchFn.mockResolvedValueOnce(new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 }));
  }
  return { gateway: kie({ apiKey: 'kie-key', fetchFn: fetchFn as unknown as typeof fetch }), fetchFn };
}

describe('kie adapter — createTask', () => {
  it('posts {model, input} with the bearer key and returns the task id', async () => {
    const { gateway, fetchFn } = replying({ body: KIE_CREATED });

    const out = await gateway.run({ model: 'nano-banana-2' }, { prompt: 'a lake', resolution: '1K', image_input: ['https://x/a.png'] });

    expect(out).toEqual({ taskId: KIE_CREATED.data.taskId });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.kie.ai/api/v1/jobs/createTask');
    expect(init.headers.Authorization).toBe('Bearer kie-key');
    expect(JSON.parse(init.body)).toEqual({ model: 'nano-banana-2', input: { prompt: 'a lake', resolution: '1K', image_input: ['https://x/a.png'] } });
  });

  it('treats an HTTP 200 whose body code is not 200 as a refusal, with kie\'s reason', async () => {
    const { gateway } = replying({ body: KIE_REFUSED_IN_BODY });

    await expect(gateway.run({ model: 'nano-banana-2' }, {})).rejects.toThrow(/kie_failed: 422 resolution is not within/);
  });

  it('turns declared numeric fields into numbers before sending', async () => {
    const { gateway, fetchFn } = replying({ body: KIE_CREATED });

    await gateway.run({ model: 'bytedance/seedance-2', numeric: ['duration'] }, { prompt: 'p', duration: '5' });

    expect(JSON.parse(fetchFn.mock.calls[0][1].body).input).toEqual({ prompt: 'p', duration: 5 });
  });
});

describe('kie adapter — recordInfo', () => {
  it('reads a running task as pending', async () => {
    const { gateway, fetchFn } = replying({ body: KIE_WAITING });

    expect(await gateway.task('task_1')).toEqual({ state: 'pending' });
    expect(fetchFn.mock.calls[0][0]).toBe('https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_1');
  });

  it('reads success: the urls from the resultJson string, the cost from creditsConsumed', async () => {
    const { gateway } = replying({ body: KIE_SUCCESS });

    expect(await gateway.task('task_1')).toEqual({
      state: 'done',
      outputs: [{ url: 'https://tempfile.aiquickdraw.com/h/ab12.png', contentType: 'image/png' }],
      costUsd: 8 * KIE_CREDIT_USD
    });
  });

  it('reads fail with kie\'s message', async () => {
    const { gateway } = replying({ body: KIE_FAILED });

    expect(await gateway.task('task_x')).toEqual({ state: 'failed', error: 'kie_task_failed: Internal error, please try again later.' });
  });

  it('never reads a 200 with no data as still running: that void once waited out ten minutes', async () => {
    const { gateway } = replying({ body: KIE_EMPTY_RECORD });

    await expect(gateway.task('task_1')).rejects.toThrow(/kie_poll_empty/);
  });

  it('throws on an HTTP error so the reconciler retries the poll instead of failing the run', async () => {
    const { gateway } = replying({ status: 502, body: {} });

    await expect(gateway.task('task_1')).rejects.toThrow(/HTTP 502/);
  });
});
