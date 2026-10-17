import { loadSession } from '../lib/auth.ts';
import { orgsApi } from '../lib/orgs.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

export async function cmdOrgs() {
  const { orgs } = await orgsApi.list(await token());
  for (const org of orgs) {
    console.log(`${org.active ? '*' : ' '} ${org.id}  ${org.name}  (${org.role})`);
  }
}

export async function cmdOrgsUse(orgId: string) {
  await orgsApi.switch(await token(), orgId);
  console.log(`Active organisation: ${orgId}. The web app, the CLI and agents now work there.`);
}

export async function cmdOrgsCreate(name: string) {
  const { org_id } = await orgsApi.create(await token(), name);
  console.log(`Created "${name}" (${org_id}); it is now your active organisation.`);
}
