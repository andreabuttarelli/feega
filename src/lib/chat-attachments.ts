export enum AttachmentKind {
  Image = 'image',
  Document = 'document'
}

export enum AttachmentError {
  Empty = 'attachment_empty',
  TooLarge = 'attachment_too_large',
  Unsupported = 'attachment_unsupported',
  TooMany = 'too_many_attachments',
  Unreadable = 'attachment_unreadable',
  Refused = 'attachment_refused',
  NotFound = 'attachment_not_found',
  InvalidPath = 'attachment_invalid_path'
}

const MB = 1024 * 1024;
const KB = 1024;

export const CHAT_ATTACHMENT_MAX_BYTES = 20 * MB;
export const CHAT_ATTACHMENT_MAX_COUNT = 10;
export const CHAT_ATTACHMENT_FOLDER = 'chat';
const NAME_SEPARATOR = '__';

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const DOCUMENT_EXT = new Set(['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'txt', 'md', 'markdown', 'html', 'htm']);

export const CHAT_ATTACH_ACCEPT = [...IMAGE_MIME, ...[...IMAGE_EXT, ...DOCUMENT_EXT].map((e) => `.${e}`)].join(',');

export type ChatAttachment = { assetId: string; kind: AttachmentKind; name: string; mimeType: string; bytes: number };

export type AttachmentVerdict = { ok: true; kind: AttachmentKind } | { ok: false; error: AttachmentError };

export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}

function kindOf(mimeType: string, name: string): AttachmentKind | null {
  const ext = extOf(name);
  if (IMAGE_MIME.has(mimeType.toLowerCase()) || IMAGE_EXT.has(ext)) {
    return AttachmentKind.Image;
  }
  if (DOCUMENT_EXT.has(ext)) {
    return AttachmentKind.Document;
  }
  return null;
}

export function attachmentVerdict(mimeType: string, name: string, bytes: number): AttachmentVerdict {
  if (!bytes) {
    return { ok: false, error: AttachmentError.Empty };
  }
  const kind = kindOf(mimeType, name);
  if (!kind) {
    return { ok: false, error: AttachmentError.Unsupported };
  }
  if (bytes > CHAT_ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: AttachmentError.TooLarge };
  }
  return { ok: true, kind };
}

export function parseAttachments(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, CHAT_ATTACHMENT_MAX_COUNT);
}

export function chatAttachmentPrefix(orgId: string, projectId: string): string {
  return `${orgId}/${projectId}/${CHAT_ATTACHMENT_FOLDER}/`;
}

export function chatAttachmentPath(orgId: string, projectId: string, id: string, name: string): string {
  return `${chatAttachmentPrefix(orgId, projectId)}${id}${NAME_SEPARATOR}${name.replace(/[^\w. -]+/g, '_').slice(0, 120)}`;
}

export function attachmentNameOf(path: string): string {
  const file = path.split('/').pop() ?? '';
  const at = file.indexOf(NAME_SEPARATOR);
  return at < 0 ? file : file.slice(at + NAME_SEPARATOR.length);
}

export function formatBytes(bytes: number): string {
  if (bytes < KB) {
    return `${bytes} B`;
  }
  if (bytes < MB) {
    return `${Math.round(bytes / KB)} KB`;
  }
  return `${(bytes / MB).toFixed(1)} MB`;
}

export function attachedNote(attachments: readonly ChatAttachment[]): string {
  if (!attachments.length) {
    return '';
  }
  return `\n\n[Attached: ${attachments.map((a) => `${a.name} (${a.kind}, asset ${a.assetId})`).join('; ')}]`;
}
