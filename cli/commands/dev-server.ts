import { loadSession } from '../lib/auth.ts';
import { DevAction, devServerApi } from '../lib/dev-server.ts';

const LOG_TAIL = 20;

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    throw new Error('Session expired or missing. Run: feega login');
  }
  return session.access_token;
}

export async function cmdDevServer(action: string) {
  if (!Object.values(DevAction).includes(action as DevAction)) {
    throw new Error(`Unknown action ${action}: use status, start or stop`);
  }

  const status = await devServerApi(await token(), action as DevAction);
  console.log(`${status.state}${status.url ? ` · ${status.url}` : ''} · ${status.source} · ${status.folder}`);
  if (status.logs.length) {
    console.log(status.logs.slice(-LOG_TAIL).join(''));
  }
}
