import type { CloudComment, CommentDraft } from '../host/cloud-api';
import type { Pick, Source } from '../messages';
import { selectorOf } from './agent-context';

export const PIN_SLOT_PREFIX = 'pin:';

export type Thread = { root: CloudComment; replies: CloudComment[] };

export type Pin = { id: string; number: number; source: Source; stack: number; replies: number };

const byTime = (a: CloudComment, b: CloudComment) => a.createdAt.localeCompare(b.createdAt);

export const sourceOfComment = (c: CloudComment): Source => ({ file: c.sourceFile, line: c.sourceLine, col: c.sourceCol });

const sourceKey = (s: Source) => `${s.file}:${s.line}:${s.col}`;

export function threadsOf(comments: CloudComment[], showResolved: boolean): Thread[] {
  const roots = comments.filter((c) => c.parentId === null).sort(byTime);

  return roots
    .filter((root) => showResolved || root.resolvedAt === null)
    .map((root) => ({ root, replies: comments.filter((c) => c.parentId === root.id).sort(byTime) }));
}

export function pinsOf(threads: Thread[]): Pin[] {
  const open = threads.filter((t) => t.root.resolvedAt === null);
  const onElement = new Map<string, number>();

  return open.map((thread, index) => {
    const source = sourceOfComment(thread.root);
    const key = sourceKey(source);
    const stack = onElement.get(key) ?? 0;
    onElement.set(key, stack + 1);
    return { id: thread.root.id, number: index + 1, source, stack, replies: thread.replies.length };
  });
}

export const pinSlot = (id: string) => `${PIN_SLOT_PREFIX}${id}`;

export const pinIdOf = (slot: string): string | null => (slot.startsWith(PIN_SLOT_PREFIX) ? slot.slice(PIN_SLOT_PREFIX.length) : null);

export function draftOf(pick: Pick | null, text: string, replyTo?: CloudComment): CommentDraft | null {
  const body = text.trim();
  if (!body) {
    return null;
  }
  if (replyTo) {
    return { body, selector: replyTo.selector, sourceFile: replyTo.sourceFile, sourceLine: replyTo.sourceLine, sourceCol: replyTo.sourceCol, parentId: replyTo.id };
  }
  if (!pick) {
    return null;
  }
  return { body, selector: selectorOf(pick), sourceFile: pick.source.file, sourceLine: pick.source.line, sourceCol: pick.source.col };
}
