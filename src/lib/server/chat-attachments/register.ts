import sharp from 'sharp';
import type { Db } from '$lib/server/db/client';
import {
  AttachmentError,
  AttachmentKind,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MAX_COUNT,
  attachmentNameOf,
  attachmentVerdict,
  chatAttachmentPath,
  chatAttachmentPrefix,
  type ChatAttachment
} from '$lib/chat-attachments';
import type { ProjectMode } from '$lib/project-mode';
import { findAssets, insertAsset, type Asset } from '$lib/server/repos/assets';
import { CANVAS_ASSET_BUCKET, removeAssetFile, signAssetFile } from '$lib/server/repos/asset-storage';
import type { ScreenOutcome } from '$lib/server/moderation/screen';
import { SafeFetchError, safeFetchBytes, type SafeFetchBytesResult } from '$lib/server/tool-guard';
import { attachmentMarkdown } from './convert';

const IMPORT_TIMEOUT_MS = 20_000;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_LARGE = 413;
const HTTP_UNPROCESSABLE = 422;

const STATUS_OF: Record<AttachmentError, number> = {
  [AttachmentError.Empty]: HTTP_BAD_REQUEST,
  [AttachmentError.TooLarge]: HTTP_TOO_LARGE,
  [AttachmentError.Unsupported]: HTTP_BAD_REQUEST,
  [AttachmentError.TooMany]: HTTP_BAD_REQUEST,
  [AttachmentError.Unreadable]: HTTP_UNPROCESSABLE,
  [AttachmentError.Refused]: HTTP_UNPROCESSABLE,
  [AttachmentError.NotFound]: HTTP_NOT_FOUND,
  [AttachmentError.InvalidPath]: HTTP_BAD_REQUEST
};

const MESSAGE_OF: Record<AttachmentError, string> = {
  [AttachmentError.Empty]: 'The file is empty.',
  [AttachmentError.TooLarge]: `Files can be at most ${CHAT_ATTACHMENT_MAX_BYTES / 1024 / 1024} MB.`,
  [AttachmentError.Unsupported]: 'Unsupported file: attach an image (PNG, JPG, WebP, GIF) or a PDF, DOCX, PPTX, XLSX, CSV, TXT, MD or HTML file.',
  [AttachmentError.TooMany]: 'Too many attachments for one message.',
  [AttachmentError.Unreadable]: 'No text could be read from this file.',
  [AttachmentError.Refused]: 'This image was refused by the safety review.',
  [AttachmentError.NotFound]: 'The uploaded file was not found.',
  [AttachmentError.InvalidPath]: 'Invalid attachment path.'
};

export class AttachmentFailure extends Error {
  readonly status: number;
  constructor(readonly code: AttachmentError, message = MESSAGE_OF[code]) {
    super(message);
    this.status = STATUS_OF[code];
  }
}

export type AttachmentScope = { orgId: string; projectId: string; mode: ProjectMode };
export type AttachmentPorts = { screenImage: (input: { orgId: string; mode: ProjectMode; url: string }) => Promise<ScreenOutcome> };

const ASSET_KIND: Record<string, AttachmentKind | undefined> = { image: AttachmentKind.Image, document: AttachmentKind.Document };

function verdictOrThrow(mimeType: string, name: string, bytes: number): AttachmentKind {
  const verdict = attachmentVerdict(mimeType, name, bytes);
  if (!verdict.ok) {
    throw new AttachmentFailure(verdict.error);
  }
  return verdict.kind;
}

export async function signAttachment(db: Db, scope: Omit<AttachmentScope, 'mode'>, file: { name: string; mimeType: string; bytes: number }) {
  verdictOrThrow(file.mimeType, file.name, file.bytes);
  const path = chatAttachmentPath(scope.orgId, scope.projectId, crypto.randomUUID(), file.name);
  const { data, error } = await db.storage.from(CANVAS_ASSET_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(error?.message ?? 'sign failed');
  }
  return { path, uploadUrl: data.signedUrl, token: data.token };
}

async function screened(db: Db, scope: AttachmentScope, path: string, ports: AttachmentPorts) {
  const outcome = await ports.screenImage({ orgId: scope.orgId, mode: scope.mode, url: await signAssetFile(db, path) });
  if (outcome.ok) {
    return;
  }
  await removeAssetFile(db, path).catch(() => undefined);
  throw new AttachmentFailure(AttachmentError.Refused, outcome.error);
}

type Contents = { content: string | null; width: number | null; height: number | null };

const CONTENTS_OF: Record<AttachmentKind, (input: { buf: ArrayBuffer; mimeType: string; name: string }) => Promise<Contents>> = {
  [AttachmentKind.Image]: async ({ buf }) => {
    const meta = await sharp(Buffer.from(buf)).metadata().catch(() => {
      throw new AttachmentFailure(AttachmentError.Unreadable, 'This image could not be read.');
    });
    return { content: null, width: meta.width ?? null, height: meta.height ?? null };
  },
  [AttachmentKind.Document]: async ({ buf, mimeType, name }) => {
    const content = await attachmentMarkdown(buf, mimeType, name).catch((e: unknown) => {
      throw new AttachmentFailure(AttachmentError.Unreadable, `No text could be read from ${name}: ${e instanceof Error ? e.message : String(e)}`);
    });
    return { content, width: null, height: null };
  }
};

export async function registerAttachment(db: Db, scope: AttachmentScope, file: { path: string; mimeType: string }, ports: AttachmentPorts): Promise<ChatAttachment> {
  if (!file.path.startsWith(chatAttachmentPrefix(scope.orgId, scope.projectId)) || file.path.includes('..')) {
    throw new AttachmentFailure(AttachmentError.InvalidPath);
  }

  const name = attachmentNameOf(file.path);
  const download = await db.storage.from(CANVAS_ASSET_BUCKET).download(file.path);
  if (download.error || !download.data) {
    throw new AttachmentFailure(AttachmentError.NotFound);
  }
  const buf = await download.data.arrayBuffer();
  const kind = verdictOrThrow(file.mimeType, name, buf.byteLength);

  if (kind === AttachmentKind.Image) {
    await screened(db, scope, file.path, ports);
  }
  const contents = await CONTENTS_OF[kind]({ buf, mimeType: file.mimeType, name });

  const asset = await insertAsset(db, {
    orgId: scope.orgId,
    projectId: scope.projectId,
    type: kind,
    source: 'upload',
    url: file.path,
    mimeType: file.mimeType,
    bytes: buf.byteLength,
    ...contents
  });
  return { assetId: asset.id, kind, name, mimeType: file.mimeType, bytes: buf.byteLength };
}

async function storeAndRegister(db: Db, scope: AttachmentScope, file: { name: string; mimeType: string; body: Uint8Array }, ports: AttachmentPorts) {
  verdictOrThrow(file.mimeType, file.name, file.body.byteLength);
  const path = chatAttachmentPath(scope.orgId, scope.projectId, crypto.randomUUID(), file.name);
  const { error } = await db.storage.from(CANVAS_ASSET_BUCKET).upload(path, file.body, { contentType: file.mimeType });
  if (error) {
    throw new Error(error.message);
  }
  return registerAttachment(db, scope, { path, mimeType: file.mimeType }, ports);
}

async function download(url: string): Promise<SafeFetchBytesResult> {
  const fetched = await safeFetchBytes(url, { maxBytes: CHAT_ATTACHMENT_MAX_BYTES, timeoutMs: IMPORT_TIMEOUT_MS }).catch((e: unknown) => {
    if (e instanceof SafeFetchError && e.reason === 'too_large') {
      throw new AttachmentFailure(AttachmentError.TooLarge);
    }
    return null;
  });
  if (!fetched?.ok) {
    throw new AttachmentFailure(AttachmentError.NotFound, `Could not download ${url}.`);
  }
  return fetched;
}

export async function importAttachment(db: Db, scope: AttachmentScope, source: { url: string; name?: string }, ports: AttachmentPorts): Promise<ChatAttachment> {
  const fetched = await download(source.url);
  const body = new Uint8Array(fetched.bytes);
  const mimeType = fetched.mime;
  const name = source.name ?? decodeURIComponent(new URL(source.url).pathname.split('/').pop() || 'file');
  return storeAndRegister(db, scope, { name, mimeType, body }, ports);
}

export async function inlineAttachment(db: Db, scope: AttachmentScope, source: { data: string; name: string; mimeType: string }, ports: AttachmentPorts): Promise<ChatAttachment> {
  return storeAndRegister(db, scope, { name: source.name, mimeType: source.mimeType, body: new Uint8Array(Buffer.from(source.data, 'base64')) }, ports);
}

export function attachmentOf(asset: Asset): ChatAttachment | null {
  const kind = ASSET_KIND[asset.type];
  if (!kind || !asset.url) {
    return null;
  }
  return { assetId: asset.id, kind, name: attachmentNameOf(asset.url), mimeType: asset.mimeType ?? '', bytes: asset.bytes ?? 0 };
}

export async function loadAttachments(db: Db, input: { orgId: string; projectId: string; ids: string[] }): Promise<ChatAttachment[]> {
  const found = await findAssets(db, { orgId: input.orgId, assetIds: input.ids });
  return input.ids
    .map((id) => found.get(id))
    .filter((a): a is Asset => a?.projectId === input.projectId)
    .map(attachmentOf)
    .filter((a): a is ChatAttachment => a !== null);
}

export const ATTACHMENT_PORTS: AttachmentPorts = {
  screenImage: async ({ orgId, mode, url }) => {
    const { screenModelReferences } = await import('$lib/server/moderation/model-input');
    const { ReferenceMedium } = await import('$lib/server/moderation/people');
    return screenModelReferences({ orgId, mode, references: [{ medium: ReferenceMedium.Image, url }] });
  }
};

export type AttachmentSource = { asset_id: string } | { url: string; name?: string } | { data: string; name: string; mime_type: string };

async function resolveSource(db: Db, scope: AttachmentScope, source: AttachmentSource, ports: AttachmentPorts): Promise<ChatAttachment> {
  if ('asset_id' in source) {
    const [found] = await loadAttachments(db, { orgId: scope.orgId, projectId: scope.projectId, ids: [source.asset_id] });
    if (!found) {
      throw new AttachmentFailure(AttachmentError.NotFound, `Asset ${source.asset_id} is not an image or document of this project.`);
    }
    return found;
  }
  if ('url' in source) {
    return importAttachment(db, scope, source, ports);
  }
  return inlineAttachment(db, scope, { data: source.data, name: source.name, mimeType: source.mime_type }, ports);
}

export async function resolveSources(db: Db, scope: AttachmentScope, sources: readonly AttachmentSource[], ports: AttachmentPorts): Promise<ChatAttachment[]> {
  if (sources.length > CHAT_ATTACHMENT_MAX_COUNT) {
    throw new AttachmentFailure(AttachmentError.TooMany, `At most ${CHAT_ATTACHMENT_MAX_COUNT} attachments per message.`);
  }
  const resolved: ChatAttachment[] = [];
  for (const source of sources) {
    resolved.push(await resolveSource(db, scope, source, ports));
  }
  return resolved;
}
