import { Worker } from 'node:worker_threads';
import { renameSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import workerSource from './feega-pack-worker.cjs?raw';
import type { FeegaAsset, FeegaCanvas, FeegaManifest } from '$lib/canvas/feega-file';

export type PackedAsset = { row: FeegaAsset; always: boolean; bytes: Uint8Array | null };

export type PackJob = { manifest: FeegaManifest; body: Omit<FeegaCanvas, 'assets'>; assets: PackedAsset[] };

export type Packed = { hashed: number };

type Reply = { id: number; ok: true; hashed: [string, number][] } | { id: number; ok: false; error: string };

const SAVING_SUFFIX = '.saving';

export const savingPath = (path: string) => `${path}${SAVING_SUFFIX}`;

const docJson = new WeakMap<object, string>();

function jsonOfDoc(doc: unknown): string {
  if (!doc || typeof doc !== 'object') {
    return JSON.stringify(doc ?? null);
  }
  const known = docJson.get(doc);
  if (known !== undefined) {
    return known;
  }
  const json = JSON.stringify(doc);
  docJson.set(doc, json);
  return json;
}

function bodyJson({ heads, ...rest }: PackJob['body']): string {
  const headsJson = Object.entries(heads).map(([id, head]) => `${JSON.stringify(id)}:{"version":${JSON.stringify(head.version)},"doc":${jsonOfDoc(head.doc)}}`);
  return `${JSON.stringify(rest).slice(0, -1)},"heads":{${headsJson.join(',')}}}`;
}

export function createPacker() {
  const worker = new Worker(workerSource, { eval: true });
  worker.unref();
  const crcs = new WeakMap<Uint8Array, number>();
  const waiting = new Map<number, { resolve: (reply: Reply) => void; reject: (error: Error) => void }>();
  let next = 0;
  let closed = false;

  worker.on('message', (reply: Reply) => {
    waiting.get(reply.id)?.resolve(reply);
    waiting.delete(reply.id);
  });
  worker.on('exit', () => {
    waiting.forEach(({ reject }) => reject(new Error('packer stopped')));
    waiting.clear();
  });

  async function write(path: string, job: PackJob): Promise<Packed> {
    const id = next++;
    const saving = savingPath(path);
    const byFile = new Map(job.assets.flatMap((a) => (a.row.file && a.bytes ? [[a.row.file, a.bytes] as const] : [])));
    const reply = await new Promise<Reply>((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      worker.postMessage({
        id,
        path: saving,
        manifest: JSON.stringify(job.manifest),
        body: bodyJson(job.body),
        assets: job.assets.map((a) => ({ ...a, crc: a.bytes ? crcs.get(a.bytes) : undefined }))
      });
    });

    if (!reply.ok) {
      await rm(saving, { force: true });
      throw new Error(reply.error);
    }
    if (closed) {
      await rm(saving, { force: true });
      throw new Error('packer stopped');
    }
    reply.hashed.forEach(([file, crc]) => crcs.set(byFile.get(file)!, crc));
    renameSync(saving, path);
    return { hashed: reply.hashed.length };
  }

  return {
    write,
    stop() {
      closed = true;
      return worker.terminate();
    }
  };
}

export type Packer = ReturnType<typeof createPacker>;
