import { LinkStatus, type AccountLinks } from './account-links';

export const COMPOSIO_API = 'https://backend.composio.dev/api/v3.1';

const STATUS: Record<string, LinkStatus> = {
  ACTIVE: LinkStatus.Active,
  INITIALIZING: LinkStatus.Pending,
  INITIATED: LinkStatus.Pending,
  INACTIVE: LinkStatus.Pending,
  FAILED: LinkStatus.Gone,
  EXPIRED: LinkStatus.Gone,
  REVOKED: LinkStatus.Gone
};

const TIMEOUT_MS = 30_000;

type ProxyAnswer = { status?: number; data?: unknown; headers?: Record<string, string>; binary_data?: { url?: string } | null };

export function composioLinks(source: Record<string, string | undefined>, fetchFn: typeof fetch = fetch): AccountLinks | null {
  const apiKey = source.COMPOSIO_API_KEY;
  if (!apiKey) {
    return null;
  }

  const send = async <T>(method: string, path: string, body?: unknown): Promise<T | null> => {
    const res = await fetchFn(`${COMPOSIO_API}${path}`, {
      method,
      headers: { 'x-api-key': apiKey, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    }).catch(() => null);
    return res?.ok ? ((await res.json().catch(() => null)) as T | null) : null;
  };

  return {
    link: async (owner, toolkit, callbackUrl) => {
      const session = await send<{ session_id?: string }>('POST', '/tool_router/session', { user_id: owner, toolkits: { enable: [toolkit] } });
      const linked = session?.session_id ? await send<{ redirect_url?: string; connected_account_id?: string }>('POST', `/tool_router/session/${session.session_id}/link`, { toolkit, callback_url: callbackUrl }) : null;
      if (!linked?.redirect_url || !linked.connected_account_id) {
        throw new Error('Composio did not answer a Connect Link');
      }
      return { url: linked.redirect_url, accountId: linked.connected_account_id };
    },
    status: async (accountId) => STATUS[(await send<{ status?: string }>('GET', `/connected_accounts/${encodeURIComponent(accountId)}`))?.status ?? ''] ?? LinkStatus.Gone,
    call: async (owner, accountId, request) => {
      const parameters = Object.entries(request.query ?? {}).map(([name, value]) => ({ name, value, type: 'query' }));
      const answer = await send<ProxyAnswer>('POST', '/tools/execute/proxy', { endpoint: request.endpoint, method: 'GET', connected_account_id: accountId, user_id: owner, parameters });
      return { status: answer?.status ?? 0, data: answer?.data ?? null, headers: answer?.headers ?? {}, file: answer?.binary_data?.url ?? null };
    },
    forget: async (accountId) => {
      await send('DELETE', `/connected_accounts/${encodeURIComponent(accountId)}`);
    }
  };
}
