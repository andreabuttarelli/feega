import type { Db } from '$lib/server/db/client';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { SIGNED_URL_TTL_S, signAssetFiles } from '$lib/server/repos/asset-storage';
import { signKnowledgePaths } from '$lib/server/media-archive';
import { parseMotionDoc } from '$lib/motion/doc';
import { modeOf } from '$lib/project-mode';
import { assetUrls, motionAssets, motionTokens, type AssetSigner } from './editor';
import { EMBED_BUCKET, storeEmbed } from './embed';
import { runInBackground } from '$lib/server/background-work';
import { RebuildOutcome, rebuildEmbed, type EmbedPlace, type RebuildPorts, type StoredEmbed } from './embed-rebuild';

const LOCK_FOLDER = 'rebuild-locks';
const LOCK_TYPE = 'text/html';
const DEFAULT_TITLE = 'feega';

const embedFile = (id: string) => `${id}.html`;
const lockFile = (id: string) => `${LOCK_FOLDER}/${id}`;
const fetchBlob = (url: string) => fetch(url).then((r) => r.blob());

export function createRebuildDb(): Db {
  const use = SERVICE_ROLE_USES.find((entry) => entry.path.startsWith('src/lib/server/motion/embed-rebuild-db.ts'));
  if (!use) {
    throw new Error('embed-rebuild: voce mancante in service-role-uses.ts');
  }
  return createServiceRoleDb(use);
}

const serviceSigner =
  (db: Db): AssetSigner =>
  async (paths, ttlSeconds) => {
    const [rendered, uploaded] = await Promise.all([signKnowledgePaths(db as never, paths.generated, ttlSeconds), signAssetFiles(db, paths.uploaded, ttlSeconds)]);
    return new Map([...rendered, ...uploaded]);
  };

async function stored(db: Db, id: string): Promise<StoredEmbed | null> {
  const bucket = db.storage.from(EMBED_BUCKET);
  const { data: listed } = await bucket.list('', { search: embedFile(id) });
  const meta = (listed ?? []).find((f) => f.name === embedFile(id));
  const updatedAt = meta?.updated_at ?? meta?.created_at;
  if (!updatedAt) {
    return null;
  }
  const { data } = await bucket.download(embedFile(id));
  return data ? { page: await data.text(), updatedAt } : null;
}

type PlaceRow = { org_id: string; project_id: string; canvas_id: string; display_name: string | null; deleted_at: string | null; projects: { brand_id: string | null; mode: string | null } | null };

async function place(db: Db, id: string): Promise<EmbedPlace | null> {
  const { data } = await db.from('nodes').select('org_id, project_id, canvas_id, display_name, deleted_at, projects(brand_id, mode)').eq('id', id).eq('type', 'motion').maybeSingle();
  const row = data as PlaceRow | null;
  if (!row?.projects) {
    return null;
  }
  return { orgId: row.org_id, projectId: row.project_id, canvasId: row.canvas_id, brandId: row.projects.brand_id, title: row.display_name ?? DEFAULT_TITLE, mode: modeOf(row.projects.mode), deleted: row.deleted_at !== null };
}

async function revisionAt(db: Db, at: EmbedPlace, id: string, when: string) {
  const { data } = await db.from('motion_revisions').select('doc').eq('org_id', at.orgId).eq('node_id', id).lte('created_at', when).order('version', { ascending: false }).limit(1).maybeSingle();
  const parsed = data ? parseMotionDoc((data as { doc: unknown }).doc) : null;
  return parsed?.ok ? parsed.doc : null;
}

export function rebuildPorts(db: Db): RebuildPorts {
  return {
    stored: (id) => stored(db, id),
    place: (id) => place(db, id),
    revisionAt: (at, id, when) => revisionAt(db, at, id, when),
    input: async (at, doc) => {
      const [assets, tokens] = await Promise.all([
        motionAssets({ db, orgId: at.orgId, projectId: at.projectId, canvasId: at.canvasId, sign: serviceSigner(db) }, SIGNED_URL_TTL_S.agentPreview),
        motionTokens(db, { orgId: at.orgId, brandId: at.brandId })
      ]);
      return { doc, tokens, assetUrls: assetUrls(assets), title: at.title, fetchBlob };
    },
    claim: async (id) => !(await db.storage.from(EMBED_BUCKET).upload(lockFile(id), new Blob([id], { type: LOCK_TYPE }), { contentType: LOCK_TYPE, upsert: false })).error,
    release: async (id) => {
      await db.storage.from(EMBED_BUCKET).remove([lockFile(id)]);
    },
    write: async (id, html) => (await storeEmbed(db, id, html)).ok
  };
}

const attempted = new Set<string>();
const RETRIABLE = new Set([RebuildOutcome.Busy, RebuildOutcome.Changed, RebuildOutcome.Failed]);

export function scheduleRebuild(id: string, origin: string): void {
  if (attempted.has(id)) {
    return;
  }
  attempted.add(id);

  runInBackground(async () => {
    const outcome = await rebuildEmbed(rebuildPorts(createRebuildDb()), id, origin);
    console.info(`[embed-rebuild] ${id} ${outcome}`);
    if (RETRIABLE.has(outcome)) {
      attempted.delete(id);
    }
  }, 'embed-rebuild');
}
