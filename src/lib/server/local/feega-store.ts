import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { Db } from '$lib/server/db/client';
import { FEEGA_EXTENSION, FEEGA_REFUSAL_MESSAGE, FEEGA_VERSION, idsIn, packFeega, unpackFeega, type FeegaBlobs, type FeegaCanvas, type FeegaFile } from '$lib/canvas/feega-file';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { createMemoryDb, type Blobs, type Change, type Row, type Tables } from './memory-db';

import { LOCAL_ORG_ID, LOCAL_USER, LOCAL_USER_ID } from '$lib/local-user';

export { LOCAL_ORG_ID, LOCAL_USER };

const SAVE_DELAY_MS = 300;
const ASSET_BUCKET = 'canvas-assets';
const ABSOLUTE_URL = /^https?:\/\//;
const UNSAFE_NAME = /[^\w.-]+/g;
const PERSISTED = new Set(['canvases', 'nodes', 'nodes_connections', 'motion_revisions', 'assets', 'storage.objects']);
const BUCKETS = [ASSET_BUCKET, 'brand-knowledge', 'media'];

export type LocalPlace = { projectId: string; canvasId: string };

export type AtomicFs = {
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
};

const nodeFs: AtomicFs = { writeFile, rename };

export async function writeAtomically(path: string, bytes: Uint8Array, fs: AtomicFs = nodeFs): Promise<void> {
  const temporary = `${path}.tmp`;
  await fs.writeFile(temporary, bytes);
  await fs.rename(temporary, path);
}

function writeAtomicallyNow(path: string, bytes: Uint8Array): void {
  writeFileSync(`${path}.tmp`, bytes);
  renameSync(`${path}.tmp`, path);
}

function emptyFile(path: string): FeegaFile {
  return {
    manifest: { format: 'feega', version: FEEGA_VERSION, exportedAt: new Date().toISOString(), canvasName: basename(path, FEEGA_EXTENSION), source: { projectId: crypto.randomUUID(), canvasId: crypto.randomUUID() } },
    canvas: { nodes: [], connections: [], heads: {}, assets: [] }
  };
}

function readFile(path: string): { file: FeegaFile; blobs: FeegaBlobs } {
  if (!existsSync(path)) {
    return { file: emptyFile(path), blobs: new Map() };
  }
  const opened = unpackFeega(new Uint8Array(readFileSync(path)));
  if (!opened.ok) {
    throw new Error(`${path}: ${FEEGA_REFUSAL_MESSAGE[opened.refusal]}`);
  }
  return { file: opened.file, blobs: opened.blobs };
}

function seed(file: FeegaFile, blobs: FeegaBlobs): { tables: Tables; storage: Blobs; place: LocalPlace } {
  const place = { projectId: file.manifest.source.projectId, canvasId: file.manifest.source.canvasId };
  const org = { org_id: LOCAL_ORG_ID };
  const at = new Date().toISOString();
  const prefix = canvasUploadPrefix(LOCAL_ORG_ID, place.projectId);
  const storage: Blobs = new Map();

  const assets = file.canvas.assets.map((a) => {
    const blob = a.file ? blobs.get(a.file) : undefined;
    const path = blob && a.file ? (a.file.startsWith(`${ASSET_DIR}${prefix}`) ? a.file.slice(ASSET_DIR.length) : `${prefix}${a.file.split('/').pop()}`) : null;
    if (blob && path) {
      storage.set(`${ASSET_BUCKET}/${path}`, { bytes: blob, contentType: a.mimeType ?? 'application/octet-stream' });
    }
    return { ...org, id: a.id, project_id: place.projectId, type: a.type, source: blob ? 'upload' : 'imported', url: path ?? a.url, content: a.content, mime_type: a.mimeType, width: a.width, height: a.height, duration_s: a.durationS, bytes: blob?.byteLength ?? null, created_at: at };
  });

  const tables: Tables = new Map<string, Row[]>([
    ['orgs', [{ id: LOCAL_ORG_ID, name: 'Local', slug: 'local', plan: 'free', created_at: at }]],
    ['profiles', [{ id: LOCAL_USER_ID, email: LOCAL_USER.email, full_name: 'You', active_org_id: LOCAL_ORG_ID, onboarded_at: at, created_at: at }]],
    ['orgs_members', [{ ...org, id: crypto.randomUUID(), user_id: LOCAL_USER_ID, role: 'owner', created_at: at }]],
    ['projects', [{ ...org, id: place.projectId, name: file.manifest.canvasName, slug: 'local', mode: 'standard', brand_id: null, deleted_at: null, created_at: at, updated_at: at }]],
    ['canvases', [{ ...org, id: place.canvasId, project_id: place.projectId, name: file.manifest.canvasName, viewport: null, deleted_at: null, created_at: at, updated_at: at }]],
    ['nodes', file.canvas.nodes.map((n) => ({ ...org, id: n.id, project_id: place.projectId, canvas_id: place.canvasId, type: n.type, display_name: n.displayName, x: n.position.x, y: n.position.y, z: n.position.z, width: n.size.width, height: n.size.height, data: n.data, version: 1, deleted_at: null, created_at: at, updated_at: at }))],
    ['nodes_connections', file.canvas.connections.map((c) => ({ ...org, id: c.id, canvas_id: place.canvasId, source_node_id: c.sourceNodeId, target_node_id: c.targetNodeId, source_handle: c.sourceHandle, target_handle: c.targetHandle, mode: c.mode, deleted_at: null, created_at: at }))],
    ['motion_revisions', Object.entries(file.canvas.heads).map(([nodeId, head]) => ({ ...org, id: crypto.randomUUID(), node_id: nodeId, version: head.version, doc: head.doc, summary: null, actor_kind: 'user', actor_id: LOCAL_USER_ID, agent_key: null, sealed: true, created_at: at }))],
    ['assets', assets]
  ]);
  return { tables, storage, place };
}

const live = (row: Row) => row.deleted_at === null || row.deleted_at === undefined;
const ASSET_DIR = 'assets/';
const assetFileName = (url: string) => `${ASSET_DIR}${url.split('/').map((part) => part.replace(UNSAFE_NAME, '_')).join('/')}`;

function snapshot(tables: Tables, storage: Blobs, place: LocalPlace): Uint8Array {
  const rows = (table: string) => tables.get(table) ?? [];
  const canvas = rows('canvases').find((c) => c.id === place.canvasId);
  const nodes = rows('nodes').filter((n) => n.canvas_id === place.canvasId && live(n));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const heads = new Map<string, Row>();
  for (const revision of rows('motion_revisions')) {
    const known = heads.get(String(revision.node_id));
    if (nodeIds.has(revision.node_id) && (!known || Number(revision.version) > Number(known.version))) {
      heads.set(String(revision.node_id), revision);
    }
  }

  const body: Omit<FeegaCanvas, 'assets'> = {
    nodes: nodes.map((n) => ({ id: String(n.id), type: String(n.type), displayName: (n.display_name as string | null) ?? null, position: { x: Number(n.x), y: Number(n.y), z: Number(n.z ?? 0) }, size: { width: n.width == null ? null : Number(n.width), height: n.height == null ? null : Number(n.height) }, data: (n.data ?? {}) as Record<string, unknown> })),
    connections: rows('nodes_connections').filter((c) => c.canvas_id === place.canvasId && live(c) && nodeIds.has(c.source_node_id) && nodeIds.has(c.target_node_id)).map((c) => ({ id: String(c.id), sourceNodeId: String(c.source_node_id), targetNodeId: String(c.target_node_id), sourceHandle: (c.source_handle as string | null) ?? null, targetHandle: (c.target_handle as string | null) ?? null, mode: c.mode === 'iterate' ? 'iterate' : 'fixed' })),
    heads: Object.fromEntries([...heads].map(([id, r]) => [id, { version: Number(r.version), doc: r.doc }]))
  };

  const referenced = new Set(idsIn(body));
  const blobs: FeegaBlobs = new Map();
  const assets = rows('assets').filter((a) => referenced.has(String(a.id).toLowerCase())).map((a) => {
    const url = (a.url as string | null) ?? null;
    const blob = url && !ABSOLUTE_URL.test(url) ? BUCKETS.map((b) => storage.get(`${b}/${url}`)).find(Boolean) : undefined;
    const file = blob && url ? assetFileName(url) : null;
    if (blob && file) {
      blobs.set(file, blob.bytes);
    }
    return { id: String(a.id), type: String(a.type), mimeType: (a.mime_type as string | null) ?? null, width: (a.width as number | null) ?? null, height: (a.height as number | null) ?? null, durationS: (a.duration_s as number | null) ?? null, content: (a.content as string | null) ?? null, url: url && ABSOLUTE_URL.test(url) ? url : null, file };
  });

  const name = String(canvas?.name ?? 'Local canvas');
  return packFeega({ manifest: { format: 'feega', version: FEEGA_VERSION, exportedAt: new Date().toISOString(), canvasName: name, source: place }, canvas: { ...body, assets } }, blobs);
}

export type FeegaStoreOptions = { origin: string; saveDelayMs?: number };

export function openFeegaStore(path: string, options: FeegaStoreOptions) {
  const { file, blobs } = readFile(path);
  const { tables, storage, place } = seed(file, blobs);
  const listeners = new Set<(change: Change) => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = !existsSync(path);
  let saving: Promise<void> = Promise.resolve();

  const save = () => {
    timer = null;
    if (!dirty) {
      return saving;
    }
    dirty = false;
    saving = saving.then(() => writeAtomically(path, snapshot(tables, storage, place)));
    return saving;
  };

  const schedule = () => {
    dirty = true;
    timer ??= setTimeout(save, options.saveDelayMs ?? SAVE_DELAY_MS);
  };

  const db = createMemoryDb({
    tables,
    blobs: storage,
    user: LOCAL_USER,
    storageUrl: (bucket, key) => `${options.origin}/local/storage/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
    onChange: (change) => {
      if (PERSISTED.has(change.table)) {
        schedule();
      }
      listeners.forEach((listen) => listen(change));
    }
  });

  if (dirty) {
    schedule();
  }

  return {
    path,
    place,
    db: db as unknown as Db,
    blob: (bucket: string, key: string) => storage.get(`${bucket}/${key}`),
    subscribe(listen: (change: Change) => void) {
      listeners.add(listen);
      return () => listeners.delete(listen);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
      }
      await save();
    },
    flushNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (dirty) {
        dirty = false;
        writeAtomicallyNow(path, snapshot(tables, storage, place));
      }
    }
  };
}

export type FeegaStore = ReturnType<typeof openFeegaStore>;
