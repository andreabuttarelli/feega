import { loadSession } from '../lib/auth.ts';
import { activeOrgId, orgsApi, teamApi, type TeamOpBody } from '../lib/orgs.ts';

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

type Member = { userId: string; email: string; role: string };
type PendingInvite = { id: string; email: string; role: string };

export async function cmdTeam(opts: { org?: string }) {
  const auth = await token();
  const team = (await teamApi.get(auth, await activeOrgId(auth, opts.org))) as { role: string; members: Member[]; invites: PendingInvite[]; linkActive: boolean };
  console.log(`You are ${team.role}.`);
  for (const m of team.members) {
    console.log(`  ${m.userId}  ${m.email}  ${m.role}`);
  }
  for (const i of team.invites) {
    console.log(`  invite ${i.id}  ${i.email}  ${i.role}`);
  }
  console.log(team.linkActive ? 'Invite link: on' : 'Invite link: off');
}

export async function cmdTeamOp(body: TeamOpBody, opts: { org?: string }) {
  const auth = await token();
  const result = await teamApi.op(auth, await activeOrgId(auth, opts.org), body);
  const link = result.url ?? result.accept_url;
  console.log(link ? `Done. Link: ${link}` : 'Done.');
}
