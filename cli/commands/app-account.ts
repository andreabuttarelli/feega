import { loadSession } from '../lib/auth.ts';
import { appAccountApi } from '../lib/app-account.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

type Opts = { forget?: boolean; loginUrl?: string; email?: string; password?: string };

export async function cmdAppAccount(projectId: string, opts: Opts) {
  if (opts.loginUrl || opts.email || opts.password) {
    const { account } = await appAccountApi.set(await token(), projectId, { login_url: opts.loginUrl ?? '', email: opts.email ?? '', password: opts.password ?? '' });
    console.log(`Test account saved: ${account?.email} on ${account?.loginUrl}`);
    return;
  }

  if (opts.forget) {
    await appAccountApi.forget(await token(), projectId);
    console.log('Test account forgotten.');
    return;
  }

  const { account } = await appAccountApi.get(await token(), projectId);
  if (!account) {
    console.log('No test account: set one with --login-url, --email and --password (a TEST login: the AI sees it).');
    return;
  }

  const live = account.sessionUntil && account.sessionUntil > Date.now();
  console.log(`${account.loginUrl}  ${account.email}  ${live ? `session until ${new Date(account.sessionUntil!).toISOString()}` : 'no live session'}`);
}
