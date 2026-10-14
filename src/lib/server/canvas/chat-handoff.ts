import type { Db } from '$lib/server/db/client';
import { loadAttachments } from '$lib/server/chat-attachments/register';
import { handoffOf, type ChatHandoff } from '$lib/canvas/chat-handoff';

export async function chatHandoff(db: Db, scope: { orgId: string; projectId: string }, url: URL): Promise<ChatHandoff | null> {
  const handoff = handoffOf(url);
  if (!handoff) {
    return null;
  }

  const attachments = handoff.attachmentIds.length ? await loadAttachments(db, { ...scope, ids: handoff.attachmentIds }) : [];
  return { text: handoff.text, attachments };
}
