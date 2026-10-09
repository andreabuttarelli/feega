import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

export type AttachmentSource = { url: string; name?: string } | { asset_id: string } | { data: string; name: string; mime_type: string };

export const MAX_ATTACHMENTS = 10;
const INLINE_MAX_BYTES = 4 * 1024 * 1024;
const ASSET_PREFIX = 'asset:';

const MIME_OF: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html'
};

export async function attachmentSource(ref: string): Promise<AttachmentSource> {
  if (/^https?:\/\//.test(ref)) {
    return { url: ref };
  }
  if (ref.startsWith(ASSET_PREFIX)) {
    return { asset_id: ref.slice(ASSET_PREFIX.length) };
  }
  const body = await readFile(ref);
  if (body.byteLength > INLINE_MAX_BYTES) {
    throw new Error(`${ref}: files over ${INLINE_MAX_BYTES / 1024 / 1024} MB must be passed as a URL`);
  }
  return { data: body.toString('base64'), name: basename(ref), mime_type: MIME_OF[extname(ref).toLowerCase()] ?? 'application/octet-stream' };
}
