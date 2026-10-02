import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AgeVerdict, diditFromEnv, diditVerifier, type DiditConfig } from './didit';

const CONFIG: DiditConfig = { apiKey: 'key', webhookSecret: 'secret', workflowId: 'wf-1' };
const NOW = 1_800_000_000;

function sign(body: string, secret = CONFIG.webhookSecret): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function webhookBody(status: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ webhook_type: 'status.updated', session_id: 's-1', vendor_data: 'user-1', status, timestamp: NOW, ...extra });
}

function headers(body: string, at = NOW, signature = sign(body)): Headers {
  return new Headers({ 'x-signature': signature, 'x-timestamp': String(at) });
}

describe('the Didit adapter', () => {
  it('creates a session bound to the user and returns the hosted url', async () => {
    const fetch = vi.fn(async () => json(201, { session_id: 's-1', url: 'https://verify.didit.me/session/abc' }));
    const didit = diditVerifier(CONFIG, { fetch, now: () => NOW });

    const out = await didit.start('user-1', 'https://feega.app/back');

    expect(out).toEqual({ redirect: 'https://verify.didit.me/session/abc' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://verification.didit.me/v3/session/');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('key');
    expect(JSON.parse(String(init.body))).toEqual({ workflow_id: 'wf-1', vendor_data: 'user-1', callback: 'https://feega.app/back' });
  });

  it('a failed session creation throws instead of letting anyone through', async () => {
    const didit = diditVerifier(CONFIG, { fetch: async () => json(403, { detail: 'nope' }), now: () => NOW });
    await expect(didit.start('user-1', 'https://feega.app/back')).rejects.toThrow('didit_session_failed');
  });

  it.each([
    ['Approved', AgeVerdict.Adult],
    ['Declined', AgeVerdict.Refused],
    ['In Review', AgeVerdict.Pending],
    ['Resubmitted', AgeVerdict.Pending],
    ['Abandoned', AgeVerdict.Refused]
  ])('a signed webhook with status %s reads as %s', (status, verdict) => {
    const didit = diditVerifier(CONFIG, { fetch: vi.fn(), now: () => NOW });
    const body = webhookBody(status);

    expect(didit.readWebhook(body, headers(body))).toEqual({ verdict, userId: 'user-1', sessionId: 's-1' });
  });

  it('a webhook signed with another secret is rejected', () => {
    const didit = diditVerifier(CONFIG, { fetch: vi.fn(), now: () => NOW });
    const body = webhookBody('Approved');

    expect(didit.readWebhook(body, headers(body, NOW, sign(body, 'other')))).toBeNull();
  });

  it('a body edited after signing is rejected', () => {
    const didit = diditVerifier(CONFIG, { fetch: vi.fn(), now: () => NOW });
    const signed = webhookBody('Declined');
    const tampered = webhookBody('Approved');

    expect(didit.readWebhook(tampered, headers(signed, NOW, sign(signed)))).toBeNull();
  });

  it('a replayed webhook older than five minutes is rejected', () => {
    const didit = diditVerifier(CONFIG, { fetch: vi.fn(), now: () => NOW + 301 });
    const body = webhookBody('Approved');

    expect(didit.readWebhook(body, headers(body))).toBeNull();
  });

  it('the decision of a session is read server side, not from the redirect', async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL) => json(200, { session_id: 's-1', status: 'Approved', vendor_data: 'user-1' }));
    const didit = diditVerifier(CONFIG, { fetch, now: () => NOW });

    expect(await didit.decision('s-1')).toEqual({ verdict: AgeVerdict.Adult, userId: 'user-1', sessionId: 's-1' });
    expect(fetch.mock.calls[0]?.[0]).toBe('https://verification.didit.me/v3/session/s-1/decision/');
  });

  it('forgetting a session asks Didit for a privacy erasure without keeping face templates', async () => {
    const fetch = vi.fn(async () => json(200, { detail: 'deleted' }));
    const didit = diditVerifier(CONFIG, { fetch, now: () => NOW });

    await didit.forget('s-1');

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://verification.didit.me/v3/session/s-1/delete/');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(String(init.body))).toEqual({ retain_face_embeddings: false, deletion_instruction: 'privacy_erasure' });
  });

  it('a session already deleted counts as forgotten', async () => {
    const didit = diditVerifier(CONFIG, { fetch: async () => json(404, {}), now: () => NOW });
    await expect(didit.forget('s-1')).resolves.toBeUndefined();
  });

  it('without every key there is no Didit verifier', () => {
    expect(diditFromEnv({ DIDIT_API_KEY: 'k', DIDIT_WEBHOOK_SECRET: 's' })).toBeNull();
    expect(diditFromEnv({ DIDIT_API_KEY: 'k', DIDIT_WEBHOOK_SECRET: 's', DIDIT_WORKFLOW_ID: 'w' })).toEqual({ apiKey: 'k', webhookSecret: 's', workflowId: 'w' });
  });
});
