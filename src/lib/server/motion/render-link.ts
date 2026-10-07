import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db } from '$lib/server/db/client';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { BROWSER_RENDER_PREFIX, completeRun, createRun, failRun, runsByIds, setRunParams, type NodeRun } from '$lib/server/repos/node-runs';
import { findNode } from '$lib/server/repos/canvas';
import { findProjectById } from '$lib/server/repos/projects';
import { readRevision } from '$lib/server/repos/motion-revisions';
import { CANVAS_ASSET_BUCKET, SIGNED_URL_TTL_S, signAssetFiles } from '$lib/server/repos/asset-storage';
import { signKnowledgePaths } from '$lib/server/media-archive';
import type { Actor } from '$lib/server/repos/actor';
import { assetUrls, motionAssets, motionTokens, type AssetSigner } from './editor';
import { analyzeSounds, storageAnalysis } from './audio-analysis';
import { saveExport } from './export';
import { clipsOf, type MotionDoc } from '$lib/motion/doc';
import { exportPath } from '$lib/motion/export-plan';
import { LinkRefusal, RENDER_LINK_OPEN_MS } from '$lib/motion/render-link';
import type { BrandTokens } from '$lib/motion/brand';
import type { AudioAnalysis } from '$lib/motion/audio-analysis';

const LINK_KIND = 'browser-render';
const SECRET_BYTES = 32;
const SEPARATOR = '.';
const BROWSER_MODEL = 'browser';

type LinkState = { hash: string; expiresAt: string; claim: string | null };
type LinkParams = { kind: typeof LINK_KIND; revision: number; link: LinkState; actor: Actor };

export enum Claim {
  Take = 'take',
  Require = 'require'
}

export type LinkVerdict = { ok: true; fresh: boolean } | { ok: false; error: LinkRefusal };
export type RenderLink = { runId: string; token: string; expiresAt: string };
export type OpenLink = { ok: true; run: NodeRun; claim: string | null } | { ok: false; error: LinkRefusal };
export type LinkPayload = { name: string; revision: number; doc: MotionDoc; tokens: BrandTokens; assetUrls: Record<string, string>; analyses: Record<string, AudioAnalysis> };
export type Finished = { ok: true; assetId: string } | { ok: false; error: string };

export const hashOf = (secret: string) => createHash('sha256').update(secret).digest('hex');
const secret = () => randomBytes(SECRET_BYTES).toString('base64url');

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseToken(token: string): { runId: string; secret: string } | null {
  const at = token.indexOf(SEPARATOR);
  if (at <= 0 || at === token.length - 1) {
    return null;
  }
  return { runId: token.slice(0, at), secret: token.slice(at + 1) };
}

const linkOf = (run: NodeRun) => run.params as Partial<LinkParams>;

export function isBrowserRender(run: Pick<NodeRun, 'externalJobId'>): boolean {
  return Boolean(run.externalJobId?.startsWith(BROWSER_RENDER_PREFIX));
}

export function linkVerdict(run: NodeRun, secretText: string, claim: string | null, now: number): LinkVerdict {
  const link = linkOf(run).link;
  if (!isBrowserRender(run) || !link || !sameHash(link.hash, hashOf(secretText))) {
    return { ok: false, error: LinkRefusal.Invalid };
  }
  if (run.status !== 'running') {
    return { ok: false, error: LinkRefusal.Used };
  }
  if (link.claim) {
    return claim && sameHash(link.claim, hashOf(claim)) ? { ok: true, fresh: false } : { ok: false, error: LinkRefusal.Elsewhere };
  }
  return now > Date.parse(link.expiresAt) ? { ok: false, error: LinkRefusal.Expired } : { ok: true, fresh: true };
}

export async function createRenderLink(db: Db, input: { orgId: string; nodeId: string; version: number; actor: Actor }, now = Date.now()): Promise<RenderLink> {
  const raw = secret();
  const expiresAt = new Date(now + RENDER_LINK_OPEN_MS).toISOString();
  const params: LinkParams = { kind: LINK_KIND, revision: input.version, link: { hash: hashOf(raw), expiresAt, claim: null }, actor: input.actor };
  const run = await createRun(db, {
    orgId: input.orgId,
    nodeId: input.nodeId,
    prompt: `render v${input.version} in a browser`,
    model: BROWSER_MODEL,
    params,
    actorKind: input.actor.kind,
    actorId: input.actor.id,
    externalJobId: `${BROWSER_RENDER_PREFIX}${input.version}`
  });
  return { runId: run.id, token: `${run.id}${SEPARATOR}${raw}`, expiresAt };
}

function linkUse() {
  const use = SERVICE_ROLE_USES.find((entry) => entry.path.startsWith('src/lib/server/motion/render-link.ts'));
  if (!use) {
    throw new Error('render-link: voce mancante in service-role-uses.ts');
  }
  return use;
}

export function createRenderLinkDb(): Db {
  return createServiceRoleDb(linkUse());
}

export async function openRenderLink(db: Db, token: string, claim: string | null, mode: Claim, now = Date.now()): Promise<OpenLink> {
  const parsed = parseToken(token);
  const [run] = parsed ? await runsByIds(db, { ids: [parsed.runId] }) : [];
  if (!parsed || !run) {
    return { ok: false, error: LinkRefusal.Invalid };
  }
  const verdict = linkVerdict(run, parsed.secret, claim, now);
  if (!verdict.ok) {
    return verdict;
  }
  if (!verdict.fresh) {
    return { ok: true, run, claim: null };
  }
  if (mode === Claim.Require) {
    return { ok: false, error: LinkRefusal.Elsewhere };
  }

  const fresh = secret();
  const params = linkOf(run) as LinkParams;
  const claimed = { ...run.params, link: { ...params.link, claim: hashOf(fresh) } };
  await setRunParams(db, { orgId: run.orgId, runId: run.id, params: claimed });
  return { ok: true, run: { ...run, params: claimed }, claim: fresh };
}

async function placeOf(db: Db, run: NodeRun) {
  const record = await findNode(db, { orgId: run.orgId, nodeId: run.nodeId });
  if (!record) {
    return null;
  }
  return { record, scope: { orgId: run.orgId, projectId: record.projectId, nodeId: run.nodeId } };
}

const linkSigner =
  (db: Db): AssetSigner =>
  async (paths, ttlSeconds) => {
    const [rendered, uploaded] = await Promise.all([signKnowledgePaths(db as never, paths.generated, ttlSeconds), signAssetFiles(db, paths.uploaded, ttlSeconds)]);
    return new Map([...rendered, ...uploaded]);
  };

export async function linkPayload(db: Db, run: NodeRun): Promise<LinkPayload | null> {
  const place = await placeOf(db, run);
  const revision = Number(linkOf(run).revision);
  const head = place ? await readRevision(db, { orgId: run.orgId, nodeId: run.nodeId, version: revision }) : null;
  const project = place ? await findProjectById(db, { orgId: run.orgId, projectId: place.record.projectId }) : null;
  if (!place || !head || !project) {
    return null;
  }

  const [assets, tokens] = await Promise.all([
    motionAssets({ db, orgId: run.orgId, projectId: project.id, canvasId: place.record.canvasId, sign: linkSigner(db) }, SIGNED_URL_TTL_S.render),
    motionTokens(db, { orgId: run.orgId, brandId: project.brandId })
  ]);
  const soundIds = clipsOf(head.doc).map((c) => String(c.props.assetId ?? ''));
  const analyses = await analyzeSounds(storageAnalysis(db), { orgId: run.orgId, projectId: project.id }, assets, soundIds);
  return { name: place.record.displayName ?? 'motion', revision, doc: head.doc, tokens, assetUrls: assetUrls(assets), analyses };
}

export async function uploadSlot(db: Db, run: NodeRun): Promise<{ path: string; token: string } | null> {
  const place = await placeOf(db, run);
  if (!place) {
    return null;
  }
  const path = exportPath(place.scope, run.id);
  const { data, error } = await db.storage.from(CANVAS_ASSET_BUCKET).createSignedUploadUrl(path, { upsert: true });
  return error || !data ? null : { path, token: data.token };
}

export async function finishRenderLink(db: Db, run: NodeRun, output: { width: number; height: number; seconds: number }): Promise<Finished> {
  const place = await placeOf(db, run);
  if (!place) {
    return { ok: false, error: 'motion_node_not_found' };
  }
  const actor = linkOf(run).actor ?? { kind: 'user', id: run.actorId };
  const saved = await saveExport(db, { ...place.scope, actor, path: exportPath(place.scope, run.id), ...output });
  if (!saved.ok) {
    return saved;
  }
  await completeRun(db, { orgId: run.orgId, runId: run.id, assetId: saved.assetId, costUsd: 0 });
  return saved;
}

export async function failRenderLink(db: Db, run: NodeRun, error: string): Promise<void> {
  await failRun(db, { orgId: run.orgId, runId: run.id, error });
}
