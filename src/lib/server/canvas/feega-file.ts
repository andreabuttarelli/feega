import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { createCanvas, createConnection, createNode, deleteCanvas, listCanvases, listConnections, listNodes, type Canvas } from '$lib/server/repos/canvas';
import { ASSET_TYPES, findAssets, insertAsset, type Asset, type AssetType } from '$lib/server/repos/assets';
import { readHead } from '$lib/server/repos/motion-revisions';
import { saveMotionDoc } from '$lib/server/motion/editor';
import { CANVAS_ASSET_BUCKET, SIGNED_URL_TTL_S } from '$lib/server/repos/asset-storage';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { FEEGA_EXTENSION, FEEGA_MIME, FEEGA_VERSION, FeegaRefusal, idsIn, packFeega, remapIds, unpackFeega, type FeegaAsset, type FeegaBlobs, type FeegaCanvas } from '$lib/canvas/feega-file';

type CanvasScope = { orgId: string; projectId: string; canvasId: string };

export enum FeegaImport {
  Imported = 'imported',
  Refused = 'refused'
}

export type FeegaImportOutcome = { outcome: FeegaImport.Imported; canvas: Canvas } | { outcome: FeegaImport.Refused; refusal: FeegaRefusal };

const MOTION_TYPE = 'motion';
const ABSOLUTE_URL = /^https?:\/\//;
const UNSAFE_NAME = /[^\w.-]+/g;
const TEXT_ONLY = 'text';

const fileNameOf = (name: string) => `${name.trim().replace(UNSAFE_NAME, '-') || 'canvas'}${FEEGA_EXTENSION}`;
const assetFileName = (index: number, asset: Asset) => `assets/${index}-${(asset.url ?? asset.id).split('/').pop()?.replace(UNSAFE_NAME, '_') ?? asset.id}`;

async function assetBytes(db: Db, assets: Asset[]): Promise<Map<string, Uint8Array>> {
  const stored = assets.filter((a) => a.url && !ABSOLUTE_URL.test(a.url));
  const signed = await signAssetPaths(db, createAssetSigningDb(), {
    generated: stored.filter((a) => a.source === 'generated').map((a) => a.url as string),
    uploaded: stored.filter((a) => a.source !== 'generated').map((a) => a.url as string)
  }, SIGNED_URL_TTL_S.agentPreview);

  const fetched = await Promise.all(stored.map(async (a) => {
    const url = signed.get(a.url as string);
    const res = url ? await fetch(url) : null;
    return res?.ok ? ([a.id, new Uint8Array(await res.arrayBuffer())] as const) : null;
  }));
  return new Map(fetched.filter((entry) => entry !== null));
}

export async function exportCanvasFile(db: Db, scope: CanvasScope): Promise<{ name: string; bytes: Uint8Array } | null> {
  const canvas = (await listCanvases(db, scope)).find((c) => c.id === scope.canvasId);
  if (!canvas) {
    return null;
  }

  const [nodes, connections] = await Promise.all([listNodes(db, scope), listConnections(db, scope)]);
  const heads = await Promise.all(nodes.filter((n) => n.type === MOTION_TYPE).map(async (n) => [n.id, await readHead(db, { orgId: scope.orgId, nodeId: n.id })] as const));
  const body = {
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, displayName: n.displayName, position: n.position, size: n.size, data: n.data })),
    connections: connections.map((c) => ({ id: c.id, sourceNodeId: c.sourceNodeId, targetNodeId: c.targetNodeId, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle, mode: c.mode })),
    heads: Object.fromEntries(heads.flatMap(([id, head]) => (head ? [[id, { version: head.version, doc: head.doc }]] : [])))
  };

  const assets = [...(await findAssets(db, { orgId: scope.orgId, assetIds: idsIn(body) })).values()];
  const bytes = await assetBytes(db, assets);
  const blobs: FeegaBlobs = new Map();
  const listed: FeegaAsset[] = assets.map((a, index) => {
    const blob = bytes.get(a.id);
    const file = blob ? assetFileName(index, a) : null;
    if (file && blob) {
      blobs.set(file, blob);
    }
    return { id: a.id, type: a.type, mimeType: a.mimeType, width: a.width, height: a.height, durationS: a.durationS, content: a.content, url: a.url && ABSOLUTE_URL.test(a.url) ? a.url : null, file };
  });

  const manifest = { format: 'feega' as const, version: FEEGA_VERSION, exportedAt: new Date().toISOString(), canvasName: canvas.name, source: { projectId: scope.projectId, canvasId: scope.canvasId } };
  return { name: fileNameOf(canvas.name), bytes: packFeega({ manifest, canvas: { ...body, assets: listed } }, blobs) };
}

export async function storeCanvasFile(db: Db, scope: CanvasScope, file: { name: string; bytes: Uint8Array }): Promise<string> {
  const path = `${canvasUploadPrefix(scope.orgId, scope.projectId)}exports/${crypto.randomUUID()}/${file.name}`;
  const bucket = db.storage.from(CANVAS_ASSET_BUCKET);
  const stored = await bucket.upload(path, file.bytes, { contentType: FEEGA_MIME });
  if (stored.error) {
    throw stored.error;
  }
  const signed = await bucket.createSignedUrl(path, SIGNED_URL_TTL_S.userLink, { download: file.name });
  if (signed.error) {
    throw signed.error;
  }
  return signed.data.signedUrl;
}

const isAssetType = (type: string): type is AssetType => (ASSET_TYPES as readonly string[]).includes(type);

async function importAsset(db: Db, scope: { orgId: string; projectId: string }, asset: FeegaAsset, blobs: FeegaBlobs): Promise<string | null> {
  const type: AssetType = isAssetType(asset.type) ? asset.type : TEXT_ONLY;
  const blob = asset.file ? blobs.get(asset.file) : undefined;
  let url = asset.url;
  if (blob && asset.file) {
    url = `${canvasUploadPrefix(scope.orgId, scope.projectId)}${crypto.randomUUID()}-${asset.file.split('/').pop()}`;
    const stored = await db.storage.from(CANVAS_ASSET_BUCKET).upload(url, blob, { contentType: asset.mimeType ?? 'application/octet-stream' });
    if (stored.error) {
      throw stored.error;
    }
  }
  if (!url && asset.content === null) {
    return null;
  }

  const row = await insertAsset(db, {
    orgId: scope.orgId,
    projectId: scope.projectId,
    type,
    source: blob ? 'upload' : 'imported',
    url,
    content: asset.content,
    mimeType: asset.mimeType,
    bytes: blob?.byteLength ?? null,
    width: asset.width,
    height: asset.height,
    durationS: asset.durationS
  });
  return row.id;
}

async function fillCanvas(db: Db, scope: CanvasScope & { actor: Actor }, canvas: FeegaCanvas): Promise<void> {
  for (const n of canvas.nodes) {
    await createNode(db, { id: n.id, orgId: scope.orgId, projectId: scope.projectId, canvasId: scope.canvasId, type: n.type, displayName: n.displayName, x: n.position.x, y: n.position.y, z: n.position.z, width: n.size.width ?? undefined, height: n.size.height ?? undefined, data: n.data, actor: scope.actor });
  }
  for (const c of canvas.connections) {
    await createConnection(db, { id: c.id, orgId: scope.orgId, canvasId: scope.canvasId, sourceNodeId: c.sourceNodeId, targetNodeId: c.targetNodeId, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle, mode: c.mode, actor: scope.actor });
  }
  for (const [nodeId, head] of Object.entries(canvas.heads)) {
    const now = await readHead(db, { orgId: scope.orgId, nodeId });
    await saveMotionDoc(db, { orgId: scope.orgId, nodeId, expectedVersion: now?.version ?? 0, doc: head.doc, actor: scope.actor, summary: 'Imported from a .feega file' });
  }
}

export async function importCanvasFile(db: Db, input: { orgId: string; projectId: string; bytes: Uint8Array; actor: Actor }): Promise<FeegaImportOutcome> {
  const opened = unpackFeega(input.bytes);
  if (!opened.ok) {
    return { outcome: FeegaImport.Refused, refusal: opened.refusal };
  }

  const { manifest, canvas } = opened.file;
  const created = await createCanvas(db, { orgId: input.orgId, projectId: input.projectId, name: manifest.canvasName });
  try {
    const ids = new Map<string, string>([
      [manifest.source.projectId.toLowerCase(), input.projectId],
      [manifest.source.canvasId.toLowerCase(), created.id]
    ]);
    for (const asset of canvas.assets) {
      const id = await importAsset(db, input, asset, opened.blobs);
      if (id) {
        ids.set(asset.id.toLowerCase(), id);
      }
    }
    for (const item of [...canvas.nodes, ...canvas.connections]) {
      ids.set(item.id.toLowerCase(), crypto.randomUUID());
    }

    await fillCanvas(db, { orgId: input.orgId, projectId: input.projectId, canvasId: created.id, actor: input.actor }, remapIds(canvas, ids));
    return { outcome: FeegaImport.Imported, canvas: created };
  } catch (error) {
    await deleteCanvas(db, { orgId: input.orgId, canvasId: created.id });
    throw error;
  }
}

export async function importStoredCanvasFile(db: Db, input: { orgId: string; projectId: string; path: string; actor: Actor }): Promise<FeegaImportOutcome> {
  if (!input.path.startsWith(canvasUploadPrefix(input.orgId, input.projectId)) || input.path.includes('..')) {
    return { outcome: FeegaImport.Refused, refusal: FeegaRefusal.NotFeega };
  }
  const bucket = db.storage.from(CANVAS_ASSET_BUCKET);
  const download = await bucket.download(input.path);
  if (download.error || !download.data) {
    return { outcome: FeegaImport.Refused, refusal: FeegaRefusal.NotFeega };
  }
  try {
    return await importCanvasFile(db, { ...input, bytes: new Uint8Array(await download.data.arrayBuffer()) });
  } finally {
    await bucket.remove([input.path]);
  }
}
