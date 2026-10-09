import { json } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import type { Db } from '$lib/server/db/client';
import { AttachmentError, CHAT_ATTACHMENT_MAX_COUNT, parseAttachments, type ChatAttachment } from '$lib/chat-attachments';
import { AttachmentFailure, loadAttachments } from './register';

const HTTP_UNAUTHENTICATED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;

export async function attachmentScope(locals: App.Locals, projectId: string) {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'unauthenticated' }, { status: HTTP_UNAUTHENTICATED });
  }
  const db = await locals.db();
  if (!db) {
    return json({ error: 'no_client' }, { status: HTTP_SERVER_ERROR });
  }
  const found = await findReachableProject(db, { projectId, memberships: await listMemberships(db, user.id), userId: user.id });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: HTTP_NOT_FOUND });
  }
  return { db, scope: { orgId: found.orgId, projectId: found.project.id, mode: found.project.mode } } as const;
}

export const failed = (e: AttachmentFailure) => json({ error: e.message, code: e.code }, { status: e.status });

export async function answered<T>(work: () => Promise<T>): Promise<Response> {
  try {
    return json(await work());
  } catch (e) {
    if (e instanceof AttachmentFailure) {
      return failed(e);
    }
    throw e;
  }
}

export async function askedAttachments(db: Db, scope: { orgId: string; projectId: string }, raw: unknown): Promise<ChatAttachment[] | Response> {
  if (Array.isArray(raw) && raw.length > CHAT_ATTACHMENT_MAX_COUNT) {
    return failed(new AttachmentFailure(AttachmentError.TooMany, `At most ${CHAT_ATTACHMENT_MAX_COUNT} attachments per message.`));
  }
  const ids = parseAttachments(raw);
  const loaded = ids.length ? await loadAttachments(db, { ...scope, ids }) : [];
  if (loaded.length !== ids.length) {
    return failed(new AttachmentFailure(AttachmentError.NotFound));
  }
  return loaded;
}
