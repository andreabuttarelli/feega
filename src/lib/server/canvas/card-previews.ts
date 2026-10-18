import type { Db } from '$lib/server/db/client';
import { CANVAS_ASSET_BUCKET, SIGNED_URL_TTL_S } from '$lib/server/repos/asset-storage';

export type CardPreview = { hash: string; url: string };
type Scope = { orgId: string; projectId: string };

const FOLDER = 'card-previews';
const LIST_LIMIT = 1000;
const NAME = /^([0-9a-zA-Z-]{1,64})\.([0-9a-f]{64})\.webp$/;
const NODE_ID = /^[0-9a-zA-Z-]{1,64}$/;
const HASH = /^[0-9a-f]{64}$/;

const folderOf = (s: Scope) => `${s.orgId}/${s.projectId}/${FOLDER}`;
const nameOf = (nodeId: string, hash: string) => `${nodeId}.${hash}.webp`;

function parse(name: string): { nodeId: string; hash: string } | null {
  const m = NAME.exec(name);
  return m ? { nodeId: m[1], hash: m[2] } : null;
}

async function listed(db: Db, scope: Scope) {
  const { data, error } = await db.storage.from(CANVAS_ASSET_BUCKET).list(folderOf(scope), { limit: LIST_LIMIT });
  if (error) {
    throw error;
  }
  return (data ?? []).flatMap((f) => {
    const p = parse(f.name);
    return p ? [{ ...p, name: f.name, at: f.updated_at ?? '' }] : [];
  });
}

export async function cardPreviews(db: Db, scope: Scope): Promise<Record<string, CardPreview>> {
  const newest = new Map<string, { hash: string; name: string; at: string }>();
  for (const f of await listed(db, scope)) {
    const seen = newest.get(f.nodeId);
    if (!seen || f.at > seen.at) {
      newest.set(f.nodeId, f);
    }
  }
  if (!newest.size) {
    return {};
  }

  const paths = [...newest.values()].map((f) => `${folderOf(scope)}/${f.name}`);
  const { data, error } = await db.storage.from(CANVAS_ASSET_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_S.canvas);
  if (error) {
    throw error;
  }
  const signed = new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
  return Object.fromEntries(
    [...newest].flatMap(([nodeId, f]) => {
      const url = signed.get(`${folderOf(scope)}/${f.name}`);
      return url ? [[nodeId, { hash: f.hash, url }]] : [];
    })
  );
}

export async function saveCardPreview(db: Db, input: Scope & { nodeId: string; hash: string; file: File }): Promise<void> {
  if (!NODE_ID.test(input.nodeId) || !HASH.test(input.hash)) {
    throw new Error('invalid card preview name');
  }
  const bucket = db.storage.from(CANVAS_ASSET_BUCKET);
  const name = nameOf(input.nodeId, input.hash);
  const older = (await listed(db, input)).filter((f) => f.nodeId === input.nodeId && f.name !== name);

  const { error } = await bucket.upload(`${folderOf(input)}/${name}`, input.file, { contentType: input.file.type, upsert: false });
  if (error && !/exists/i.test(error.message)) {
    throw error;
  }
  if (older.length) {
    await bucket.remove(older.map((f) => `${folderOf(input)}/${f.name}`));
  }
}
