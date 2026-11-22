export type CliSession = { access_token: string; refresh_token: string; expires_at: number; state: string };

export enum PostOutcome {
  Sent = 'sent',
  Rejected = 'rejected',
  Unreachable = 'unreachable'
}

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost'];
const EXTENSION_ID = 'andreabuttarelli.feega';
const SIGN_IN_PATH = '/signin';
const DESKTOP_LABEL = 'Feega';
const DESKTOP_SIGN_IN_URL = 'feega://signin';

const EDITORS = [
  { label: 'VS Code', scheme: 'vscode' },
  { label: 'Cursor', scheme: 'cursor' },
  { label: 'Windsurf', scheme: 'windsurf' },
  { label: 'VSCodium', scheme: 'vscodium' }
] as const;

export async function postSession(port: string | number, session: CliSession, send: typeof fetch = fetch): Promise<PostOutcome> {
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
    targetAddressSpace: 'loopback'
  };

  for (const host of LOOPBACK_HOSTS) {
    try {
      const res = await send(`http://${host}:${port}/session`, init);
      return res.ok ? PostOutcome.Sent : PostOutcome.Rejected;
    } catch {
      continue;
    }
  }

  return PostOutcome.Unreachable;
}

type OpenLink = { label: string; href: string };

const queryOf = (session: CliSession) =>
  new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: String(session.expires_at),
    state: session.state
  });

export function desktopLink(session: CliSession): OpenLink {
  return { label: DESKTOP_LABEL, href: `${DESKTOP_SIGN_IN_URL}?${queryOf(session)}` };
}

export function editorLinks(session: CliSession): OpenLink[] {
  const query = queryOf(session);

  return EDITORS.map(({ label, scheme }) => ({ label, href: `${scheme}://${EXTENSION_ID}${SIGN_IN_PATH}?${query}` }));
}
