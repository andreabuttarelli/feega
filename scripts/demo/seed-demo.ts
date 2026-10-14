import { createServiceRoleDb, type Db } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { createProject, findProjectBySlug } from '$lib/server/repos/projects';
import { createCanvas, listCanvases, listNodes } from '$lib/server/repos/canvas';
import { startFromTemplate, FROM_TEMPLATE_DEPS, FromTemplate } from '$lib/server/motion/from-template';
import { MotionFormat } from '$lib/motion/doc';
import type { Actor } from '$lib/server/repos/actor';

const OWNER_ROLE = 'owner';
const COLUMN_W = 640;
const DEMO_PREFIX = 'demo-';

type Frame = { template: string; format: MotionFormat; title: string };
type Client = { slug: string; name: string; canvas: string; frames: Frame[] };

const CLIENTS: Client[] = [
  {
    slug: `${DEMO_PREFIX}stride-sneakers`,
    name: 'Stride Sneakers',
    canvas: 'Spring drop campaign',
    frames: [
      { template: 'builtin:poster-type-grid', format: MotionFormat.Portrait, title: 'Drop poster' },
      { template: 'builtin:split-headline', format: MotionFormat.Vertical, title: 'Teaser' },
      { template: 'builtin:phone-split', format: MotionFormat.Square, title: 'App feature' }
    ]
  },
  {
    slug: `${DEMO_PREFIX}luma-coffee`,
    name: 'Luma Coffee',
    canvas: 'Autumn menu',
    frames: [
      { template: 'builtin:poster-vertical-type', format: MotionFormat.Portrait, title: 'Menu poster' },
      { template: 'builtin:floating-media', format: MotionFormat.Vertical, title: 'Reel opener' }
    ]
  },
  {
    slug: `${DEMO_PREFIX}orbit-fintech`,
    name: 'Orbit Fintech',
    canvas: 'Product launch',
    frames: [
      { template: 'builtin:saas-monitor', format: MotionFormat.Landscape, title: 'Launch film' },
      { template: 'builtin:poster-red-number', format: MotionFormat.Portrait, title: 'Stat poster' }
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
  const { data } = await db.from('profiles').select('id').eq('email', email).maybeSingle();
  if (!data) {
    throw new Error(`seed-demo: no account for ${email}`);
  }
  return data.id as string;
}

async function ownedOrg(db: Db, userId: string, wanted: string | null): Promise<string> {
  const { data } = await db.from('orgs_members').select('org_id').eq('user_id', userId).eq('role', OWNER_ROLE);
  const owned = (data ?? []).map((row) => row.org_id as string);
  const orgId = wanted ?? owned[0];
  if (!orgId || !owned.includes(orgId)) {
    throw new Error(`seed-demo: the account owns no org${wanted ? ` ${wanted}` : ''}; the seed never creates one`);
  }
  return orgId;
}

async function seedClient(db: Db, scope: { orgId: string; userId: string; actor: Actor }, client: Client) {
  const project = (await findProjectBySlug(db, { orgId: scope.orgId, slug: client.slug })) ?? (await createProject(db, { orgId: scope.orgId, name: client.name, slug: client.slug }));
  const canvases = await listCanvases(db, { orgId: scope.orgId, projectId: project.id });
  const canvasId = canvases[0]?.id ?? (await createCanvas(db, { orgId: scope.orgId, projectId: project.id, name: client.canvas })).id;
  const present = new Set((await listNodes(db, { orgId: scope.orgId, canvasId })).map((n) => n.displayName));

  for (const [column, frame] of client.frames.entries()) {
    if (present.has(frame.title)) {
      continue;
    }
    const started = await startFromTemplate(db, FROM_TEMPLATE_DEPS, { orgId: scope.orgId, projectId: project.id, canvasId, userId: scope.userId, templateId: frame.template, format: frame.format, at: { x: column * COLUMN_W, y: 0 }, actor: scope.actor });
    if (started.outcome !== FromTemplate.Started) {
      throw new Error(`seed-demo: ${frame.template} ${started.outcome}`);
    }
    await db.from('nodes').update({ display_name: frame.title }).eq('id', started.start.nodeId);
  }
  console.log(`${client.name}: /p/${project.id}/c/${canvasId}`);
  return project.id;
}

async function main() {
  const [email, orgArg] = process.argv.slice(2);
  if (!email) {
    throw new Error('usage: seed-demo <account email> [org id]');
  }
  const db = createServiceRoleDb(seedUse());
  const userId = await userIdOf(db, email);
  const orgId = await ownedOrg(db, userId, orgArg ?? null);
  const scope = { orgId, userId, actor: { kind: 'user', id: userId } as Actor };
  for (const client of CLIENTS) {
    await seedClient(db, scope, client);
  }
  console.log(`demo projects ready in org ${orgId} for ${email}`);
}

await main();
