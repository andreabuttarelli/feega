import { createServiceRoleDb, type Db } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { createProject, findProjectBySlug } from '$lib/server/repos/projects';
import { createCanvas, createNode, listCanvases, listNodes } from '$lib/server/repos/canvas';
import { readHead, RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { saveMotionDoc } from '$lib/server/motion/editor';
import { newMotionData } from '$lib/canvas/motion-node';
import { MotionFormat } from '$lib/motion/doc';
import { builtinTemplate } from '$lib/motion/template/builtins';
import { starterDoc, type StarterFormat } from '$lib/motion/template/catalogue';
import type { Actor } from '$lib/server/repos/actor';

const ORG_NAME = 'Northside Studio';
const ORG_SLUG_PREFIX = 'demo-agency';
const OWNER_ROLE = 'owner';
const DEMO_CREDITS = 20_000;
const DEMO_KEY = 'demoKey';
const COLUMN_W = 640;

type Frame = { key: string; template: string; format: StarterFormat; title: string };
type Client = { slug: string; name: string; canvas: string; frames: Frame[] };

const CLIENTS: Client[] = [
  {
    slug: 'stride-sneakers',
    name: 'Stride Sneakers',
    canvas: 'Spring drop campaign',
    frames: [
      { key: 'stride-poster', template: 'builtin:poster-type-grid', format: MotionFormat.Vertical, title: 'Drop poster' },
      { key: 'stride-teaser', template: 'builtin:split-headline', format: MotionFormat.Vertical, title: 'Teaser 10s' },
      { key: 'stride-phone', template: 'builtin:phone-split', format: MotionFormat.Square, title: 'App feature' }
    ]
  },
  {
    slug: 'luma-coffee',
    name: 'Luma Coffee',
    canvas: 'Autumn menu',
    frames: [
      { key: 'luma-poster', template: 'builtin:poster-vertical-type', format: MotionFormat.Vertical, title: 'Menu poster' },
      { key: 'luma-reel', template: 'builtin:floating-media', format: MotionFormat.Vertical, title: 'Reel opener' }
    ]
  },
  {
    slug: 'orbit-fintech',
    name: 'Orbit Fintech',
    canvas: 'Product launch',
    frames: [
      { key: 'orbit-monitor', template: 'builtin:saas-monitor', format: MotionFormat.Landscape, title: 'Launch film' },
      { key: 'orbit-poster', template: 'builtin:poster-red-number', format: MotionFormat.Vertical, title: 'Stat poster' }
    ]
  }
];

function seedUse() {
  const use = SERVICE_ROLE_USES.find((entry) => entry.path === 'scripts/demo/seed-demo.ts');
  if (!use) {
    throw new Error('seed-demo: missing entry in service-role-uses.ts');
  }
  return use;
}

async function userIdOf(db: Db, email: string): Promise<string> {
  const { data, error } = await db.from('profiles').select('id').eq('email', email).maybeSingle();
  if (error || !data) {
    throw new Error(`seed-demo: no account for ${email}; sign up first`);
  }
  return data.id as string;
}

async function agencyOrg(db: Db, userId: string): Promise<string> {
  const slug = `${ORG_SLUG_PREFIX}-${userId.slice(0, 8)}`;
  const { data: found } = await db.from('orgs').select('id').eq('slug', slug).maybeSingle();
  const orgId = (found?.id as string | undefined) ?? (await createOrg(db, slug));
  await db.from('orgs_members').upsert({ org_id: orgId, user_id: userId, role: OWNER_ROLE }, { onConflict: 'org_id,user_id' });
  return orgId;
}

async function createOrg(db: Db, slug: string): Promise<string> {
  const { data, error } = await db.from('orgs').insert({ name: ORG_NAME, slug }).select('id').single();
  if (error) {
    throw new Error(`seed-demo: org ${error.message}`);
  }
  return data.id as string;
}

async function topUp(db: Db, orgId: string) {
  const { data } = await db.from('credit_ledger').select('amount').eq('org_id', orgId);
  const balance = (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  if (balance >= DEMO_CREDITS) {
    return;
  }
  await db.from('credit_ledger').insert({ org_id: orgId, kind: 'grant', source: 'manual', amount: DEMO_CREDITS - balance, note: 'demo workspace' });
}

async function seedFrame(db: Db, scope: { orgId: string; projectId: string; canvasId: string; actor: Actor }, frame: Frame, column: number, existing: Map<string, string>) {
  const entry = builtinTemplate(frame.template);
  if (!entry) {
    throw new Error(`seed-demo: unknown template ${frame.template}`);
  }
  if (existing.has(frame.key)) {
    return;
  }
  const made = starterDoc(entry, frame.format, () => crypto.randomUUID());
  if (!made.ok) {
    throw new Error(`seed-demo: ${frame.template} ${made.error}`);
  }
  const node = await createNode(db, { ...scope, type: 'motion', x: column * COLUMN_W, y: 0, displayName: frame.title, data: { ...newMotionData(frame.format), [DEMO_KEY]: frame.key }, actor: scope.actor });
  const head = await readHead(db, { orgId: scope.orgId, nodeId: node.id });
  const write = await saveMotionDoc(db, { orgId: scope.orgId, nodeId: node.id, actor: scope.actor, expectedVersion: head?.version ?? 0, doc: made.doc, summary: 'Demo workspace' });
  if (write.outcome !== RevisionOutcome.Written) {
    throw new Error(`seed-demo: ${frame.key} revision ${write.outcome}`);
  }
}

async function seedClient(db: Db, orgId: string, actor: Actor, client: Client) {
  const project = (await findProjectBySlug(db, { orgId, slug: client.slug })) ?? (await createProject(db, { orgId, name: client.name, slug: client.slug }));
  const canvases = await listCanvases(db, { orgId, projectId: project.id });
  const canvasId = canvases[0]?.id ?? (await createCanvas(db, { orgId, projectId: project.id, name: client.canvas })).id;
  const scope = { orgId, projectId: project.id, canvasId, actor };
  const present = await listNodes(db, scope);
  const existing = new Map(present.flatMap((n) => (typeof n.data?.[DEMO_KEY] === 'string' ? [[n.data[DEMO_KEY] as string, n.id]] : [])));
  for (const [column, frame] of client.frames.entries()) {
    await seedFrame(db, scope, frame, column, existing);
  }
  console.log(`${client.name}: /p/${project.id}/c/${canvasId}`);
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    throw new Error('usage: seed-demo <account email>');
  }
  const db = createServiceRoleDb(seedUse());
  const userId = await userIdOf(db, email);
  const orgId = await agencyOrg(db, userId);
  await topUp(db, orgId);
  const actor: Actor = { kind: 'user', id: userId };
  for (const client of CLIENTS) {
    await seedClient(db, orgId, actor, client);
  }
  console.log(`org ${orgId} ready for ${email}`);
}

await main();
