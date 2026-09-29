import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { wiro } from './wiro';

function recorder(reply: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return reply();
  });
  const gateway = wiro({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://wiro.test/v1', fetchFn: fetchFn as typeof fetch, nonce: () => '1790000000' });
  return { calls, gateway };
}

const task = (fields: Record<string, unknown>) =>
  Response.json({ result: true, errors: [], tasklist: [{ id: '534574', status: 'task_start', pexit: '0', totalcost: '0', outputs: [], ...fields }] });

describe('Wiro adapter', () => {
  it('runs a model at /Run/{owner}/{project} with HMAC signed headers', async () => {
    const { calls, gateway } = recorder(() => Response.json({ result: true, errors: [], taskid: '2221', socketaccesstoken: 't' }));
    const out = await gateway.run({ owner: 'wiro-partners', project: 'z-image-uncensored' }, { prompt: 'a lake', ratio: '1:1' });

    expect(out).toEqual({ taskId: '2221' });
    expect(calls[0].url).toBe('https://wiro.test/v1/Run/wiro-partners/z-image-uncensored');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('key');
    expect(headers['x-nonce']).toBe('1790000000');
    expect(headers['x-signature']).toBe(createHmac('sha256', 'key').update('secret1790000000').digest('hex'));
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ prompt: 'a lake', ratio: '1:1' });
  });

  it('refuses a run Wiro answers with result:false, carrying its errors', async () => {
    const { gateway } = recorder(() => Response.json({ result: false, errors: [{ message: 'insufficient balance' }] }));
    await expect(gateway.run({ owner: 'o', project: 'p' }, {})).rejects.toThrow(/insufficient balance/);
  });

  it('reads a running task as pending', async () => {
    const { calls, gateway } = recorder(() => task({ status: 'task_start' }));
    expect(await gateway.task('534574')).toEqual({ state: 'pending' });
    expect(calls[0].url).toBe('https://wiro.test/v1/Task/Detail');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ taskid: '534574' });
  });

  it('reads a finished task with its outputs and billed cost', async () => {
    const { gateway } = recorder(() =>
      task({ status: 'task_postprocess_end', totalcost: '0.013', outputs: [{ url: 'https://cdn.wiro.test/0.png', contenttype: 'image/png' }] })
    );
    expect(await gateway.task('534574')).toEqual({
      state: 'done',
      costUsd: 0.013,
      outputs: [{ url: 'https://cdn.wiro.test/0.png', contentType: 'image/png' }]
    });
  });

  it('reads a non-zero exit or a cancel as failed', async () => {
    const failed = recorder(() => task({ status: 'task_postprocess_end', pexit: '1', debugoutput: 'nsfw filter' }));
    expect(await failed.gateway.task('1')).toEqual({ state: 'failed', error: 'wiro_task_failed: nsfw filter' });
    const cancelled = recorder(() => task({ status: 'task_cancel' }));
    expect(await cancelled.gateway.task('1')).toMatchObject({ state: 'failed' });
  });

  it('signs with the API key alone when no secret is configured', async () => {
    const fetchFn = vi.fn(async () => Response.json({ result: true, taskid: '1' }));
    await wiro({ apiKey: 'key', fetchFn: fetchFn as unknown as typeof fetch }).run({ owner: 'o', project: 'p' }, {});
    const headers = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('key');
    expect(headers['x-signature']).toBeUndefined();
  });
});
