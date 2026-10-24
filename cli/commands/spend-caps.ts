import { loadSession } from '../lib/auth.ts';
import { spendCapsApi, type CapReset, type CapScope } from '../lib/spend-caps.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

export async function cmdCaps(opts: { org?: string }) {
  const { caps } = await spendCapsApi.get(await token(), opts.org);
  if (!caps.length) {
    console.log('No spend caps.');
    return;
  }
  for (const cap of caps) {
    const where = cap.project_id ? ` project ${cap.project_id}` : '';
    console.log(`${cap.scope}${where}: $${cap.cap_usd} (${cap.reset})`);
  }
}

export async function cmdCapsSet(scope: CapScope, amount: string, opts: { org?: string; project?: string; reset?: CapReset }) {
  const capUsd = amount === 'off' ? null : Number(amount);
  const saved = await spendCapsApi.set(await token(), { scope, project_id: opts.project, cap_usd: capUsd, reset: opts.reset }, opts.org);
  console.log(saved.cap_usd === null ? `${saved.scope}: removed` : `${saved.scope}: $${saved.cap_usd} (${saved.reset})`);
}
