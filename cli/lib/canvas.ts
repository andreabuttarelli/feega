import { request } from './api.ts';

export type CanvasCall = { project: string; op: string; input?: Record<string, unknown> };

export type CanvasUpload = { project: string; fileName: string; bytes: Uint8Array; canvasId?: string; x?: number; y?: number };

type Refusal = { error?: string; message?: string };
type SignedUpload = Refusal & { path?: string; uploadUrl?: string };
type SignedImport = SignedUpload & { mimeType?: string };
type SavedFile = Refusal & { name?: string; url?: string };

export type CanvasFile = { project: string; canvasId: string };
export type CanvasFileImport = { project: string; bytes: Uint8Array };

const MIME_OF_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  md: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html'
};

const UNKNOWN_MIME = 'application/octet-stream';

export function mimeTypeOf(fileName: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? '';
  return MIME_OF_EXT[ext] ?? UNKNOWN_MIME;
}

const withOrg = (path: string, org?: string) => (org ? `${path}?${new URLSearchParams({ org })}` : path);

function refused(answer: Refusal): never {
  throw new Error(answer.message ?? answer.error ?? 'refused');
}

async function firstCanvas(token: string, project: string, org?: string): Promise<string> {
  const { canvases } = await canvasApi.run<{ canvases: { id: string }[] }>(token, { project, op: 'list_canvases' }, org);
  const first = canvases[0];
  if (!first) {
    throw new Error('This project has no canvas.');
  }
  return first.id;
}

async function putBytes(url: string, bytes: Uint8Array, mimeType: string): Promise<void> {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: bytes });
  if (!res.ok) {
    throw new Error(`Upload ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  }
}

export const canvasApi = {
  run: <T = unknown>(token: string, call: CanvasCall, org?: string) =>
    request<T>(withOrg('/api/v1/org/canvas', org), token, {
      method: 'POST',
      body: JSON.stringify({ project_id: call.project, op: call.op, input: call.input ?? {} })
    }),

  upload: async (token: string, file: CanvasUpload, org?: string) => {
    const mimeType = mimeTypeOf(file.fileName);
    const meta = { fileName: file.fileName, mimeType, bytes: file.bytes.byteLength };

    const signed = await canvasApi.run<SignedUpload>(token, { project: file.project, op: 'request_upload', input: meta }, org);
    if (!signed.path || !signed.uploadUrl) {
      refused(signed);
    }

    const canvasId = file.canvasId ?? (await firstCanvas(token, file.project, org));
    await putBytes(signed.uploadUrl, file.bytes, mimeType);

    const input = { ...meta, canvasId, path: signed.path, x: file.x ?? 0, y: file.y ?? 0 };
    const registered = await canvasApi.run<Refusal & { node?: unknown; asset?: unknown }>(token, { project: file.project, op: 'register_upload', input }, org);
    if (!registered.node) {
      refused(registered);
    }
    return registered;
  },

  saveFile: async (token: string, file: CanvasFile, org?: string) => {
    const saved = await canvasApi.run<SavedFile>(token, { project: file.project, op: 'export_canvas_file', input: { canvasId: file.canvasId } }, org);
    if (!saved.url || !saved.name) {
      refused(saved);
    }
    const res = await fetch(saved.url);
    if (!res.ok) {
      throw new Error(`Download ${res.status}`);
    }
    return { name: saved.name, bytes: new Uint8Array(await res.arrayBuffer()) };
  },

  importFile: async (token: string, file: CanvasFileImport, org?: string) => {
    const signed = await canvasApi.run<SignedImport>(token, { project: file.project, op: 'request_canvas_import', input: { bytes: file.bytes.byteLength } }, org);
    if (!signed.path || !signed.uploadUrl) {
      refused(signed);
    }
    await putBytes(signed.uploadUrl, file.bytes, signed.mimeType ?? UNKNOWN_MIME);

    const imported = await canvasApi.run<Refusal & { canvas?: { id: string; name: string }; path?: string }>(token, { project: file.project, op: 'import_canvas_file', input: { path: signed.path } }, org);
    if (!imported.canvas) {
      refused(imported);
    }
    return imported;
  }
};
