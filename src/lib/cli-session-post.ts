export type CliSession = { access_token: string; refresh_token: string; expires_at: number; state: string };

export enum PostOutcome {
  Sent = 'sent',
  Rejected = 'rejected',
  Unreachable = 'unreachable'
}

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost'];
const EXTENSION_ID = 'andreabuttarelli.feega';
const SIGN_IN_PATH = '/signin';

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

export function editorLinks(session: CliSession): { label: string; href: string }[] {
  const query = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: String(session.expires_at),
    state: session.state
  });

  return EDITORS.map(({ label, scheme }) => ({ label, href: `${scheme}://${EXTENSION_ID}${SIGN_IN_PATH}?${query}` }));
}
