import { describe, expect, it, vi } from 'vitest';
import { LinkStatus, Toolkit } from './account-links';
import { composioLinks, COMPOSIO_API } from './composio-links';

type Sent = { url: string; method: string; body: unknown; key: string | null };

function backend(answers: Record<string, unknown>) {
  const sent: Sent[] = [];
  const fetchFn = vi.fn(async (url: string, init: RequestInit = {}) => {
    sent.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : null, key: new Headers(init.headers).get('x-api-key') });
    const key = `${init.method ?? 'GET'} ${url.replace(COMPOSIO_API, '')}`;
    return key in answers ? new Response(JSON.stringify(answers[key])) : new Response('{}', { status: 404 });
  });
  return { sent, fetchFn: fetchFn as unknown as typeof fetch };
}

describe('composioLinks', () => {
  it('senza chiave non c\'è nessun collegamento', () => {
    expect(composioLinks({}, fetch)).toBeNull();
  });

  it('collegare apre una sessione per il proprietario e chiede il Connect Link col ritorno', async () => {
    const { sent, fetchFn } = backend({ 'POST /tool_router/session': { session_id: 's1' }, 'POST /tool_router/session/s1/link': { redirect_url: 'https://connect.composio.dev/x', connected_account_id: 'ca_1' } });

    const started = await composioLinks({ COMPOSIO_API_KEY: 'k' }, fetchFn)!.link('o1:u1', Toolkit.GitHub, 'https://feega.app/cb');

    expect(started).toEqual({ url: 'https://connect.composio.dev/x', accountId: 'ca_1' });
    expect(sent[0]).toMatchObject({ method: 'POST', body: { user_id: 'o1:u1', toolkits: { enable: ['github'] } }, key: 'k' });
    expect(sent[1].body).toEqual({ toolkit: 'github', callback_url: 'https://feega.app/cb' });
  });

  it('lo stato del conto si legge come attivo, in attesa o perso', async () => {
    const { fetchFn } = backend({ 'GET /connected_accounts/ca_1': { status: 'ACTIVE' }, 'GET /connected_accounts/ca_2': { status: 'INITIATED' }, 'GET /connected_accounts/ca_3': { status: 'REVOKED' } });
    const links = composioLinks({ COMPOSIO_API_KEY: 'k' }, fetchFn)!;

    expect([await links.status('ca_1'), await links.status('ca_2'), await links.status('ca_3'), await links.status('ca_9')]).toEqual([LinkStatus.Active, LinkStatus.Pending, LinkStatus.Gone, LinkStatus.Gone]);
  });

  it('una chiamata passa dal proxy col conto e il proprietario, e riporta il file binario', async () => {
    const { sent, fetchFn } = backend({ 'POST /tools/execute/proxy': { status: 200, data: null, headers: { 'content-type': 'application/x-gzip' }, binary_data: { url: 'https://files/t.tgz' } } });

    const answer = await composioLinks({ COMPOSIO_API_KEY: 'k' }, fetchFn)!.call('o1:u1', 'ca_1', { endpoint: '/user/repos', query: { per_page: '100' } });

    expect(answer).toEqual({ status: 200, data: null, headers: { 'content-type': 'application/x-gzip' }, file: 'https://files/t.tgz' });
    expect(sent[0].body).toEqual({ endpoint: '/user/repos', method: 'GET', connected_account_id: 'ca_1', user_id: 'o1:u1', parameters: [{ name: 'per_page', value: '100', type: 'query' }] });
  });

  it('dimenticare cancella il conto', async () => {
    const { sent, fetchFn } = backend({ 'DELETE /connected_accounts/ca_1': {} });

    await composioLinks({ COMPOSIO_API_KEY: 'k' }, fetchFn)!.forget('ca_1');

    expect(sent[0]).toMatchObject({ method: 'DELETE', url: `${COMPOSIO_API}/connected_accounts/ca_1` });
  });
});
