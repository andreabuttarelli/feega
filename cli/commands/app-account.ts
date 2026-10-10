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

export async function cmdAppAccount(projectId: string, opts: { forget?: boolean }) {
  if (opts.forget) {
    await appAccountApi.forget(await token(), projectId);
    console.log('Test account forgotten.');
    return;
  }

  const { account } = await appAccountApi.get(await token(), projectId);
  if (!account) {
    console.log('No test account: give one to the project chat (url, email, password of a TEST login).');
    return;
  }

  const live = account.sessionUntil && account.sessionUntil > Date.now();
  console.log(`${account.loginUrl}  ${account.email}  ${live ? `session until ${new Date(account.sessionUntil!).toISOString()}` : 'no live session'}`);
}
