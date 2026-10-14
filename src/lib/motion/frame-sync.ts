import type { MotionDoc } from './doc';
import { diffDoc, rebase, type DocOp } from './doc-ops';

export type Revision = { version: number; doc: MotionDoc };

export type Synced = { base: Revision; present: MotionDoc };

export function outgoing(base: Revision, present: MotionDoc): DocOp[] {
  return diffDoc(base.doc, present);
}

export function remote(base: Revision, present: MotionDoc, head: Revision): Synced | null {
  if (head.version <= base.version) {
    return null;
  }
  return { base: head, present: rebase(base.doc, present, head.doc) };
}

export function landed(base: Revision, sent: MotionDoc, present: MotionDoc, server: Revision): Synced {
  if (server.version <= base.version) {
    return { base, present };
  }
  const untouched = present === sent && !outgoing({ version: 0, doc: sent }, server.doc).length;
  return { base: server, present: untouched ? present : rebase(sent, present, server.doc) };
}
