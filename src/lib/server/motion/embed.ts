import { env as publicEnv } from '$env/dynamic/public';
import type { Db } from '$lib/server/db/client';
import { embedRefusal, type PublishRefusal } from '$lib/gallery/refusals';
import type { ProjectMode } from '$lib/project-mode';
import { embedSettings, embedSource, embedUrl, hostedPage, upgradePlayer, type InteractiveInput } from '$lib/motion/interactive/bundle';
import { embedSnippet, type EmbedSettings } from '$lib/motion/interactive/loader';
import { assetOf, hostAssets, type HostedAsset } from './embed-assets';

export const EMBED_BUCKET = 'embeds';
const EMBED_TYPE = 'text/html';
const EMBED_CACHE_S = 60;
const NODE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EmbedResult = { ok: true } | { ok: false; error: string };
export type EmbedRefused = { ok: false; error: string; refusal: PublishRefusal };
export type EmbedSlot = { ok: true; upload: { url: string; headers: Record<string, string> } } | { ok: false; error: string } | EmbedRefused;
export type PublishedEmbed = { ok: true; url: string; snippet: string } | { ok: false; error: string } | EmbedRefused;
export type EmbedPublish = Omit<InteractiveInput, 'settings'> & { nodeId: string; mode: ProjectMode };

const embedPath = (nodeId: string) => `${nodeId}.html`;
const bucketOf = (db: Db) => db.storage.from(EMBED_BUCKET);
const outcome = (error: { message: string } | null): EmbedResult => (error ? { ok: false, error: error.message } : { ok: true });

function refused(mode: ProjectMode): EmbedRefused | null {
  const refusal = embedRefusal(mode);
  return refusal ? { ok: false, error: refusal.message, refusal: refusal.refusal } : null;
}

export const isRefused = (result: { ok: boolean }): result is EmbedRefused => 'refusal' in result;

export const embedOrigin = () => (publicEnv.PUBLIC_APP_URL ?? '').replace(/\/$/, '');

export async function storeEmbed(db: Db, nodeId: string, html: string): Promise<EmbedResult> {
  const { error } = await bucketOf(db).upload(embedPath(nodeId), new Blob([html], { type: EMBED_TYPE }), { contentType: EMBED_TYPE, cacheControl: String(EMBED_CACHE_S), upsert: true });
  return outcome(error);
}

export async function publishEmbed(db: Db, input: EmbedPublish, origin = embedOrigin()): Promise<PublishedEmbed> {
  const refusal = refused(input.mode);
  if (refusal) {
    return refusal;
  }

  const stored = await storeEmbed(db, input.nodeId, await embedSource(input));
  if (!stored.ok) {
    return stored;
  }

  const url = embedUrl(origin, input.nodeId);
  return { ok: true, url, snippet: embedSnippet(origin, input.nodeId) };
}

export async function embedSlot(db: Db, nodeId: string, mode: ProjectMode): Promise<EmbedSlot> {
  const refusal = refused(mode);
  if (refusal) {
    return refusal;
  }

  const { data, error } = await bucketOf(db).createSignedUploadUrl(embedPath(nodeId), { upsert: true });
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'no upload slot' };
  }
  return { ok: true, upload: { url: data.signedUrl, headers: { 'content-type': EMBED_TYPE, 'cache-control': `max-age=${EMBED_CACHE_S}`, 'x-upsert': 'true' } } };
}

export async function removeEmbed(db: Db, nodeId: string): Promise<EmbedResult> {
  const { error } = await bucketOf(db).remove([embedPath(nodeId)]);
  return outcome(error);
}

export async function embedPublished(db: Db, nodeId: string): Promise<boolean> {
  const { data } = await bucketOf(db).list('', { search: embedPath(nodeId) });
  return (data ?? []).some((f) => f.name === embedPath(nodeId));
}

async function storedEmbed(fetchFn: typeof fetch, id: string): Promise<string | null> {
  if (!NODE_ID.test(id)) {
    return null;
  }
  const res = await fetchFn(`${publicEnv.PUBLIC_SUPABASE_URL}/storage/v1/object/public/${EMBED_BUCKET}/${embedPath(id)}`);
  return res.ok ? res.text() : null;
}

export const assetBase = (origin: string, id: string) => `${embedUrl(origin, id)}/a`;

export async function readEmbed(fetchFn: typeof fetch, id: string, origin: string): Promise<string | null> {
  const page = await storedEmbed(fetchFn, id);
  return page === null ? null : hostAssets(hostedPage(page, origin) ?? upgradePlayer(page, origin) ?? page, assetBase(origin, id));
}

export async function readEmbedAsset(fetchFn: typeof fetch, id: string, hash: string): Promise<HostedAsset | null> {
  const page = await storedEmbed(fetchFn, id);
  return page === null ? null : assetOf(page, hash);
}

export async function readEmbedSettings(fetchFn: typeof fetch, id: string): Promise<EmbedSettings | null> {
  const page = await storedEmbed(fetchFn, id);
  return page === null ? null : embedSettings(page);
}
