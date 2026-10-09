import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { createServiceRoleDb, type Db } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { createProject, findProjectBySlug, type Project } from '$lib/server/repos/projects';
import { createCanvas, createNode, DataCheck, listCanvases, listNodes, patchNodeData } from '$lib/server/repos/canvas';
import { insertAsset, listProjectAssets, type Asset, type AssetType } from '$lib/server/repos/assets';
import { signAssetFiles, storeAssetFile } from '$lib/server/repos/asset-storage';
import { signKnowledgePaths } from '$lib/server/media-archive';
import { readHead, RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { saveMotionDoc, type AssetSigner } from '$lib/server/motion/editor';
import { publishMotionEmbed } from '$lib/server/motion/agent-embed';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { motionEditorPath, newMotionData } from '$lib/canvas/motion-node';
import { formatOf, parseMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { docProblems } from '$lib/motion/direction';
import { factsOf } from '$lib/gallery/model';
import type { Actor } from '$lib/server/repos/actor';
import { SHOWCASE } from './showcase-catalogue';

export const SHOWCASE_KEY = 'showcaseKey';
const SOURCE_DIR = resolve(process.env.FEEGA_VIDEOS_DIR ?? join(homedir(), 'Documents/feega-videos'));
const ORG_ID = process.env.SHOWCASE_ORG_ID ?? '82813960-3537-4ec8-8524-b966b46105f1';
const ORIGIN = 'https://oh.feega.app';
const PROJECT_NAME = 'Showcase';
const PROJECT_SLUG = 'showcase';
const OWNER_ROLE = 'owner';
const DRY_RUN = process.argv.includes('--dry-run');
const GRID_COLUMNS = 4;
const CELL = { w: 520, h: 640 };
const POSTER_SHARE = 0.4;
const POSTER_WIDTH = 1280;
const EMBED_ATTEMPTS = 3;

const MIME: Readonly<Record<string, string>> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4'
};

const ASSET_TYPE: Readonly<Record<string, AssetType>> = { image: 'image', audio: 'audio', video: 'video' };

export type ShowcaseSource = { key: string; title: string; doc: string; files: Record<string, string>; preview: string };

export type PlanItem = { key: string; title: string; doc: MotionDoc; files: Record<string, string>; preview: string | null; spot: { x: number; y: number }; notes: string[] };

export type Plan = { items: PlanItem[]; skipped: { key: string; why: string }[] };

const generative = (ratio: string, title: string): ShowcaseSource => ({
  key: `showcase-generative-${ratio}`,
  title,
  doc: `showcase/generative/doc-${ratio}.json`,
  files: { music: 'showcase/generative/music.mp3' },
  preview: `showcase/generative/generative-${ratio}.mp4`
});

const leadFinder = (ratio: string, title: string): ShowcaseSource => ({
  key: `showcase-lead-finder-${ratio}`,
  title,
  doc: `showcase/lead-finder/doc-${ratio}.json`,
  files: { music: 'showcase/lead-finder/music.mp3', logo: 'showcase/lead-finder/logo.svg' },
  preview: `showcase/lead-finder/lead-finder-${ratio}.mp4`
});

export const SHOWCASE_SOURCES: readonly ShowcaseSource[] = [
  ...SHOWCASE.map(({ key, title, doc, files, preview }) => ({ key, title, doc, files, preview })),
  generative('16x9', 'Generative'),
  generative('9x16', 'Generative, vertical'),
  leadFinder('16x9', 'Lead finder'),
  leadFinder('9x16', 'Lead finder, vertical'),
  { key: 'saturn', title: 'Saturn', doc: 'saturn/doc.json', files: {}, preview: 'saturn/saturn-16x9.mp4' }
];

const spotAt = (index: number) => ({ x: (index % GRID_COLUMNS) * CELL.w, y: Math.floor(index / GRID_COLUMNS) * CELL.h });

const unshipped = (doc: MotionDoc, files: Record<string, string>) => doc.assets.filter((a) => !files[a.id]).map((a) => `no file for asset ${a.id}`);

function notesOf(doc: MotionDoc): string[] {
  const audioAssets = doc.assets.filter((a) => a.kind === 'audio').length;
  return docProblems(doc, { audioAssets }).map((p) => p.kind);
}

export function showcasePlan(sourceDir: string, sources: readonly ShowcaseSource[]): Plan {
  const plan: Plan = { items: [], skipped: [] };

  for (const source of sources) {
    const missing = [source.doc, ...Object.values(source.files)].find((f) => !existsSync(join(sourceDir, f)));
    if (missing) {
      plan.skipped.push({ key: source.key, why: `${missing} is missing` });
      continue;
    }

    const verdict = parseMotionDoc(JSON.parse(readFileSync(join(sourceDir, source.doc), 'utf8')));
    if (!verdict.ok) {
      plan.skipped.push({ key: source.key, why: verdict.error });
      continue;
    }

    const files = Object.fromEntries(Object.entries(source.files).map(([id, f]) => [id, join(sourceDir, f)]));
    const missingFiles = unshipped(verdict.doc, files);
    if (missingFiles.length) {
      plan.skipped.push({ key: source.key, why: missingFiles.join('; ') });
      continue;
    }

    const preview = join(sourceDir, source.preview);
    plan.items.push({ key: source.key, title: source.title, doc: verdict.doc, files, preview: existsSync(preview) ? preview : null, spot: spotAt(plan.items.length), notes: notesOf(verdict.doc) });
  }

  return plan;
}

const NAMING_KEYS: ReadonlySet<string> = new Set(['id', 'name', 'key', 'label', 'clipId', 'prop', 'component']);

function swapped(value: unknown, ids: Readonly<Record<string, string>>): unknown {
  if (typeof value === 'string') {
    return ids[value] ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => swapped(v, ids));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, NAMING_KEYS.has(k) ? v : swapped(v, ids)]));
}

export function remapAssets(doc: MotionDoc, ids: Readonly<Record<string, string>>): MotionDoc {
  const remapped = swapped(doc, ids) as MotionDoc;
  return { ...remapped, assets: doc.assets.map((a) => ({ ...a, id: ids[a.id] ?? a.id })) };
}

export function showcaseNode<T extends { type: string; data: Record<string, unknown> }>(nodes: readonly T[], key: string): T | null {
  return nodes.find((n) => n.type === 'motion' && n.data[SHOWCASE_KEY] === key) ?? null;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical((value as Record<string, unknown>)[k])]));
}

export function docHash(doc: MotionDoc): string {
  return createHash('sha256').update(JSON.stringify(canonical(doc))).digest('hex');
}

type Scope = { orgId: string; projectId: string };

export function assetPath(scope: Scope, key: string, id: string, file: string): string {
  return `${canvasUploadPrefix(scope.orgId, scope.projectId)}showcase/${key}/${id}${extname(file).toLowerCase()}`;
}

function importUse() {
  const use = SERVICE_ROLE_USES.find((entry) => entry.path.startsWith('scripts/import-showcase.ts'));
  if (!use) {
    throw new Error('import-showcase: missing entry in service-role-uses.ts');
  }
  return use;
}

async function ownerOf(db: Db, orgId: string): Promise<string> {
  const { data, error } = await db.from('orgs_members').select('user_id').eq('org_id', orgId).eq('role', OWNER_ROLE).limit(1).maybeSingle();
  if (error || !data) {
    throw error ?? new Error(`no owner for org ${orgId}`);
  }
  return data.user_id;
}

async function showcaseProject(db: Db, orgId: string): Promise<{ project: Project; canvasId: string }> {
  const project = (await findProjectBySlug(db, { orgId, slug: PROJECT_SLUG })) ?? (await createProject(db, { orgId, name: PROJECT_NAME, slug: PROJECT_SLUG }));
  const canvases = await listCanvases(db, { orgId, projectId: project.id });
  const canvasId = canvases[0]?.id ?? (await createCanvas(db, { orgId, projectId: project.id, name: PROJECT_NAME })).id;
  return { project, canvasId };
}

async function storedAsset(db: Db, scope: Scope, existing: Asset[], input: { path: string; file: string; type: AssetType; nodeId: string }): Promise<Asset> {
  const found = existing.find((a) => a.url === input.path);
  if (found) {
    return found;
  }
  const bytes = readFileSync(input.file);
  const mime = MIME[extname(input.file).toLowerCase()] ?? 'application/octet-stream';
  await storeAssetFile(db, input.path, new File([new Uint8Array(bytes)], input.path.split('/').at(-1) as string, { type: mime }));
  const row = await insertAsset(db, { ...scope, type: input.type, source: 'upload', url: input.path, mimeType: mime, bytes: bytes.length, sourceNodeId: input.nodeId });
  existing.push(row);
  return row;
}

function posterFrame(work: string, item: PlanItem): string | null {
  if (!item.preview) {
    return null;
  }
  const file = join(work, `${item.key}-poster.jpg`);
  const at = factsOf(item.doc).durationS * POSTER_SHARE;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', item.preview, '-frames:v', '1', '-vf', `scale=${POSTER_WIDTH}:-2`, '-q:v', '3', file]);
  return file;
}

async function reviseDoc(db: Db, scope: { orgId: string; nodeId: string; actor: Actor }, key: string, doc: MotionDoc): Promise<void> {
  const head = await readHead(db, scope);
  if (head && docHash(head.doc) === docHash(doc)) {
    console.log(`${key}: doc unchanged, no new revision`);
    return;
  }
  const write = await saveMotionDoc(db, { ...scope, expectedVersion: head?.version ?? 0, doc, summary: 'Imported from the showcase' });
  if (write.outcome !== RevisionOutcome.Written) {
    throw new Error(`${key}: revision ${write.outcome}${'error' in write ? ` ${write.error}` : ''}`);
  }
}

async function publishedEmbed(db: Db, scope: { orgId: string; nodeId: string; sign: AssetSigner }, key: string) {
  let last = '';
  for (let attempt = 1; attempt <= EMBED_ATTEMPTS; attempt++) {
    const embed = await publishMotionEmbed(db, scope, ORIGIN);
    if (embed.ok) {
      return embed;
    }
    last = `${embed.failure} ${JSON.stringify(embed.body)}`;
    console.log(`${key}: embed attempt ${attempt} failed: ${last}`);
  }
  throw new Error(`${key}: embed ${last}`);
}

const operatorSigner =
  (db: Db): AssetSigner =>
  async (paths, ttlSeconds) => {
    const [generated, uploaded] = await Promise.all([signKnowledgePaths(db as never, paths.generated, ttlSeconds), signAssetFiles(db, paths.uploaded, ttlSeconds)]);
    return new Map([...generated, ...uploaded]);
  };

type Imported = { title: string; editor: string; embed: string; snippet: string };

async function importItem(db: Db, ctx: Scope & { canvasId: string; actor: Actor; work: string; sign: AssetSigner }, item: PlanItem): Promise<Imported> {
  const nodes = await listNodes(db, { orgId: ctx.orgId, canvasId: ctx.canvasId });
  const node =
    showcaseNode(nodes, item.key) ??
    (await createNode(db, { ...ctx, type: 'motion', ...item.spot, displayName: item.title, data: { ...newMotionData(formatOf(item.doc)), [SHOWCASE_KEY]: item.key }, actor: ctx.actor }));

  const existing = await listProjectAssets(db, ctx);
  const ids: Record<string, string> = {};
  for (const ref of item.doc.assets) {
    const file = item.files[ref.id];
    const row = await storedAsset(db, ctx, existing, { path: assetPath(ctx, item.key, ref.id, file), file, type: ASSET_TYPE[ref.kind] ?? 'image', nodeId: node.id });
    ids[ref.id] = row.id;
  }

  await reviseDoc(db, { orgId: ctx.orgId, nodeId: node.id, actor: ctx.actor }, item.key, remapAssets(item.doc, ids));

  const poster = posterFrame(ctx.work, item);
  if (poster) {
    const row = await storedAsset(db, ctx, existing, { path: assetPath(ctx, item.key, 'poster', poster), file: poster, type: 'image', nodeId: node.id });
    await patchNodeData(db, { orgId: ctx.orgId, nodeId: node.id, patch: { posterAssetId: row.id }, check: DataCheck.Schema, actor: ctx.actor });
  }

  const embed = await publishedEmbed(db, { orgId: ctx.orgId, nodeId: node.id, sign: ctx.sign }, item.key);
  return { title: item.title, editor: `${ORIGIN}${motionEditorPath({ projectId: ctx.projectId, canvasId: ctx.canvasId, nodeId: node.id })}`, embed: String(embed.body.url), snippet: String(embed.body.snippet) };
}

async function main() {
  const plan = showcasePlan(SOURCE_DIR, SHOWCASE_SOURCES);
  console.log(`${plan.items.length} cuts ready from ${SOURCE_DIR}`);
  plan.skipped.forEach((s) => console.log(`skip ${s.key}: ${s.why}`));

  if (DRY_RUN) {
    plan.items.forEach((i) => console.log(`dry ${i.key} · ${i.title} · ${formatOf(i.doc)} · assets ${i.doc.assets.map((a) => a.id).join(',') || '-'} · poster ${i.preview ? 'yes' : 'no'} · at ${i.spot.x},${i.spot.y} · notes ${[...new Set(i.notes)].join(',') || '-'}`));
    return;
  }

  const db = createServiceRoleDb(importUse());
  const ownerId = await ownerOf(db, ORG_ID);
  const { project, canvasId } = await showcaseProject(db, ORG_ID);
  const ctx = { orgId: ORG_ID, projectId: project.id, canvasId, actor: { kind: 'user', id: ownerId } as Actor, work: mkdtempSync(join(tmpdir(), 'feega-showcase-')), sign: operatorSigner(db) };

  const rows: Imported[] = [];
  const failed: string[] = [];
  for (const item of plan.items) {
    try {
      rows.push(await importItem(db, ctx, item));
    } catch (cause) {
      failed.push(item.key);
      console.error(`FAILED ${item.key}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  console.table(rows.map(({ title, editor, embed }) => ({ title, editor, embed })));
  rows.forEach((r) => console.log(`\n${r.title}\n${r.snippet}`));

  if (failed.length) {
    console.error(`${failed.length} cuts failed: ${failed.join(', ')}`);
    process.exit(1);
  }
}

if (process.env.VITEST === undefined) {
  main().catch((cause) => {
    console.error(cause);
    process.exit(1);
  });
}
