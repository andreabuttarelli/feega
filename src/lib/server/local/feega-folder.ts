import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { assetPath, emptyFolder, fromFiles, Keep, mergeFolders, Relation, relationOf, remoteOnly, resolveConflict, sameJson, toFiles, type Conflict, type Entity, type FolderDoc, type FolderFiles } from '@feega/canvas-folder';
import { FEEGA_REFUSAL_MESSAGE, FEEGA_VERSION, unpackFeega, type FeegaAsset, type FeegaBlobs, type FeegaFile } from '$lib/canvas/feega-file';
import { jobFile, type PackJob } from './feega-packer';

export const FOLDER_DIR = '.feega';
const BASE_DIR = '.base';
const OURS_DIR = '.ours';
const ASSET_DIR = 'assets';
const GITIGNORE = '.gitignore';
const GITIGNORE_TEXT = `${BASE_DIR}/\n${OURS_DIR}/\n`;
const LEGACY_BACKUP = 'legacy.feega';
const FOLDER_FORMAT = 'feega-folder';
const JSON_SUFFIX = '.json';
const SKIPPED_DIRS = new Set([BASE_DIR, OURS_DIR, ASSET_DIR]);
const EXTENSION = /\.([a-z0-9]{1,8})$/i;
const MIME_EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'font/woff2': 'woff2', 'font/ttf': 'ttf' };

export const FOLDER_NOTICES: Record<Relation, string | null> = {
  [Relation.Same]: null,
  [Relation.Ahead]: 'Saved changes Feega had kept aside into .feega/.',
  [Relation.Behind]: 'Loaded changes made to .feega/ outside Feega.',
  [Relation.Diverged]: 'Merged changes made to .feega/ outside Feega with yours.'
};

const OPENED_DOC: Record<Relation, (sides: { base: FolderDoc; ours: FolderDoc; disk: FolderDoc }) => FolderDoc> = {
  [Relation.Same]: ({ ours }) => ours,
  [Relation.Ahead]: ({ ours }) => ours,
  [Relation.Behind]: ({ disk }) => disk,
  [Relation.Diverged]: ({ base, ours, disk }) => mergeFolders(base, ours, disk).doc
};

export const UNSAVED_NOTICE = 'Files in .feega/ changed outside Feega. Your changes are kept aside: reopen the folder to merge them.';

export type FetchAsset = (url: string) => Promise<Uint8Array>;

export type FolderStatus = { relation: Relation; notice: string | null; conflicts: Conflict[]; unsavedSince: string | null; failedAssets: string[] };

type Assets = Map<string, Uint8Array>;

type Opened = { file: FeegaFile; blobs: FeegaBlobs; fresh: boolean };

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const extensionOf = (name: string | null | undefined, mimeType: unknown) => (name ? EXTENSION.exec(name.split('?')[0])?.[1]?.toLowerCase() : undefined) ?? MIME_EXTENSIONS[String(mimeType)] ?? '';

export const isFolder = (path: string) => existsSync(path) && statSync(path).isDirectory();

export const defaultFetchAsset: FetchAsset = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }

  return new Uint8Array(await response.arrayBuffer());
};

function fileToFolder(file: FeegaFile, blobs: FeegaBlobs): { doc: FolderDoc; assets: Assets } {
  const doc = emptyFolder();
  const assets: Assets = new Map();
  const { canvasName, source, acpAgent, acpModels, acpEfforts } = file.manifest;

  doc.canvas = { format: FOLDER_FORMAT, version: FEEGA_VERSION, canvasName, source, acpAgent, acpModels, acpEfforts };

  for (const node of file.canvas.nodes) {
    doc.collections.nodes[node.id] = { ...node, version: node.version ?? 1, head: file.canvas.heads[node.id] };
  }

  for (const connection of file.canvas.connections) {
    doc.collections.connections[connection.id] = connection;
  }

  for (const { file: path, ...row } of file.canvas.assets) {
    const bytes = path ? blobs.get(path) : undefined;
    if (!bytes) {
      doc.collections.media[row.id] = row;
      continue;
    }

    const ref = { sha256: sha256(bytes), ext: extensionOf(path, row.mimeType) };
    assets.set(assetPath(ref), bytes);
    doc.collections.media[row.id] = { ...row, ...ref };
  }

  for (const link of file.canvas.codeLinks ?? []) {
    doc.collections.codeLinks[String(link.id ?? link.node_id)] = link;
  }

  doc.events = file.canvas.events ?? [];
  return { doc, assets };
}

function folderToFile(doc: FolderDoc, readAsset: (path: string) => Uint8Array | undefined, fallbackName: string): Opened {
  const canvas = doc.canvas as { canvasName?: string; source?: { projectId: string; canvasId: string }; acpAgent?: string | null; acpModels?: Record<string, string>; acpEfforts?: Record<string, string> };
  const fresh = !canvas.source;
  const blobs: FeegaBlobs = new Map();
  const heads: FeegaFile['canvas']['heads'] = {};

  const nodes = Object.values(doc.collections.nodes).map(({ head, ...node }) => {
    if (head) {
      heads[String(node.id)] = head as { version: number; doc: unknown };
    }
    return node as FeegaFile['canvas']['nodes'][number];
  });

  const assets = Object.values(doc.collections.media).map(({ sha256: hash, ext, ...row }) => {
    const path = hash ? assetPath({ sha256: String(hash), ext: String(ext ?? '') }) : null;
    const bytes = path ? readAsset(path) : undefined;
    if (path && bytes) {
      blobs.set(path, bytes);
    }
    return { ...row, file: bytes ? path : null } as FeegaAsset;
  });

  const file: FeegaFile = {
    manifest: { format: 'feega', version: FEEGA_VERSION, exportedAt: new Date().toISOString(), canvasName: canvas.canvasName ?? fallbackName, source: canvas.source ?? { projectId: crypto.randomUUID(), canvasId: crypto.randomUUID() }, acpAgent: canvas.acpAgent ?? null, acpModels: canvas.acpModels ?? {}, acpEfforts: canvas.acpEfforts ?? {} },
    canvas: { nodes, connections: Object.values(doc.collections.connections) as FeegaFile['canvas']['connections'], heads, assets, codeLinks: Object.values(doc.collections.codeLinks), events: doc.events }
  };

  return { file, blobs, fresh };
}

function readTree(root: string): FolderFiles {
  const files: FolderFiles = new Map();
  if (!existsSync(root)) {
    return files;
  }

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) {
        walk(full);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(JSON_SUFFIX)) {
        files.set(relative(root, full), readFileSync(full, 'utf8'));
      }
    }
  };

  walk(root);
  return files;
}

function writeTree(root: string, files: FolderFiles) {
  for (const stale of readTree(root).keys()) {
    if (!files.has(stale)) {
      rmSync(join(root, stale));
    }
  }

  const existing = readTree(root);
  for (const [path, text] of files) {
    if (existing.get(path) === text) {
      continue;
    }
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

export function openFolder(dir: string, fetchAsset: FetchAsset = defaultFetchAsset) {
  const root = join(dir, FOLDER_DIR);
  const basePath = join(root, BASE_DIR);
  const oursPath = join(root, OURS_DIR);
  const downloaded = new Map<string, { sha256: string; ext: string } | null>();
  const status: FolderStatus = { relation: Relation.Same, notice: null, conflicts: [], unsavedSince: null, failedAssets: [] };

  const readAsset = (path: string) => (existsSync(join(root, path)) ? new Uint8Array(readFileSync(join(root, path))) : undefined);

  const writeAssets = (assets: Assets) => {
    for (const [path, bytes] of assets) {
      if (!existsSync(join(root, path))) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), bytes);
      }
    }
  };

  const writeAll = (doc: FolderDoc) => {
    const files = toFiles(doc);
    writeTree(root, files);
    writeTree(basePath, files);
    writeFileSync(join(root, GITIGNORE), GITIGNORE_TEXT);
    rmSync(oursPath, { recursive: true, force: true });
    status.unsavedSince = null;
  };

  const commit = (doc: FolderDoc, assets: Assets) => {
    writeAssets(assets);
    if (!sameJson(fromFiles(readTree(root)), fromFiles(readTree(basePath)))) {
      writeTree(oursPath, toFiles(doc));
      status.unsavedSince ??= new Date().toISOString();
      status.notice = UNSAVED_NOTICE;
      return;
    }

    writeAll(doc);
  };

  const withDownloads = (doc: FolderDoc) => {
    status.failedAssets = [];
    for (const media of remoteOnly(doc)) {
      const ref = downloaded.get(String(media.url));
      if (ref) {
        doc.collections.media[String(media.id)] = { ...media, ...ref };
        continue;
      }
      status.failedAssets.push(String(media.url));
    }
  };

  const download = async (doc: FolderDoc, assets: Assets) => {
    const pending = remoteOnly(doc).filter((m) => !downloaded.has(String(m.url)));
    await Promise.all(
      pending.map(async (media: Entity) => {
        const url = String(media.url);
        try {
          const bytes = await fetchAsset(url);
          const ref = { sha256: sha256(bytes), ext: extensionOf(url, media.mimeType) };
          assets.set(assetPath(ref), bytes);
          downloaded.set(url, ref);
        } catch {
          downloaded.set(url, null);
        }
      })
    );
  };

  const docOf = (job: PackJob) => {
    const { file, blobs } = jobFile(job);
    const { doc, assets } = fileToFolder(file, blobs);
    return { doc: { ...doc, conflicts: status.conflicts }, assets };
  };

  const migrateLegacy = () => {
    if (!existsSync(root) || isFolder(root)) {
      return;
    }

    const opened = unpackFeega(new Uint8Array(readFileSync(root)));
    if (!opened.ok) {
      throw new Error(`${root}: ${FEEGA_REFUSAL_MESSAGE[opened.refusal]}`);
    }
    renameSync(root, join(dir, LEGACY_BACKUP));
    const { doc, assets } = fileToFolder(opened.file, opened.blobs);
    mkdirSync(root, { recursive: true });
    writeAssets(assets);
    writeAll(doc);
  };

  const open = (): Opened => {
    migrateLegacy();
    const disk = fromFiles(readTree(root));
    const hasBase = existsSync(basePath);
    const base = hasBase ? fromFiles(readTree(basePath)) : disk;
    const ours = existsSync(oursPath) ? fromFiles(readTree(oursPath)) : base;

    status.relation = relationOf(base, ours, disk);
    const doc = OPENED_DOC[status.relation]({ base, ours, disk });
    status.notice = FOLDER_NOTICES[status.relation];
    status.conflicts = doc.conflicts;

    const opened = folderToFile(doc, readAsset, basename(dir));
    if (status.relation !== Relation.Same || !hasBase) {
      mkdirSync(root, { recursive: true });
      writeAll(doc);
    }

    return { ...opened, fresh: opened.fresh || remoteOnly(doc).length > 0 };
  };

  return {
    opened: open(),
    status: (): FolderStatus => ({ ...status, conflicts: [...status.conflicts], failedAssets: [...status.failedAssets] }),
    async write(job: PackJob) {
      const { doc, assets } = docOf(job);
      await download(doc, assets);
      withDownloads(doc);
      commit(doc, assets);
    },
    writeNow(job: PackJob) {
      const { doc, assets } = docOf(job);
      withDownloads(doc);
      commit(doc, assets);
    },
    resolve(job: PackJob, conflict: Conflict, keep: Keep): Opened {
      const { doc, assets } = docOf(job);
      withDownloads(doc);
      const resolved = resolveConflict(doc, conflict, keep);
      status.conflicts = resolved.conflicts;
      commit(resolved, assets);
      return folderToFile(resolved, readAsset, basename(dir));
    },
    stop() {}
  };
}

export type FolderPersistence = ReturnType<typeof openFolder>;
