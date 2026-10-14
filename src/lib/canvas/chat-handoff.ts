import { parseAttachments, type ChatAttachment } from '$lib/chat-attachments';

export const HANDOFF_PARAM = 'prompt';
export const HANDOFF_ATTACH_PARAM = 'attach';

const ID_SEPARATOR = ',';

export type Handoff = { text: string; attachmentIds: string[] };
export type ChatHandoff = { text: string; attachments: ChatAttachment[] };

export function handoffPath(canvas: { projectId: string; canvasId: string }, text: string, attachmentIds: readonly string[] = []): string {
  const params = new URLSearchParams({ [HANDOFF_PARAM]: text });
  if (attachmentIds.length) {
    params.set(HANDOFF_ATTACH_PARAM, attachmentIds.join(ID_SEPARATOR));
  }

  return `/p/${canvas.projectId}/c/${canvas.canvasId}?${params}`;
}

export function handoffOf(url: URL): Handoff | null {
  const text = url.searchParams.get(HANDOFF_PARAM)?.trim() ?? '';
  if (!text) {
    return null;
  }

  return { text, attachmentIds: parseAttachments(url.searchParams.get(HANDOFF_ATTACH_PARAM)?.split(ID_SEPARATOR) ?? []) };
}

export function withoutHandoff(url: URL): URL {
  const clean = new URL(url);
  clean.searchParams.delete(HANDOFF_PARAM);
  clean.searchParams.delete(HANDOFF_ATTACH_PARAM);
  return clean;
}
