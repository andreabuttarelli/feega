import { loadSession } from '../lib/auth.ts';
import { modelAllowlistApi, type AllowlistMedium } from '../lib/model-allowlist.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

export async function cmdAllowlist(opts: { org?: string }) {
  const lists = await modelAllowlistApi.get(await token(), opts.org);
  for (const [medium, ids] of Object.entries(lists)) {
    console.log(`${medium}: ${ids.length ? ids.join(', ') : 'every model'}`);
  }
}

export async function cmdAllowlistSet(medium: AllowlistMedium, ids: string[], opts: { org?: string }) {
  const saved = await modelAllowlistApi.set(await token(), { medium, model_ids: ids }, opts.org);
  console.log(`${saved.medium}: ${saved.model_ids.length ? saved.model_ids.join(', ') : 'every model'}`);
}
