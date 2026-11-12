import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { removeClips } from '@feega/motion-core/motion/timeline';
import { addBoards, boardParent, placeholderOf, type NewId } from './code-boards';
import type { ImportMap } from './import-map';

export enum LandOutcome {
  Landed = 'landed',
  Failed = 'failed',
  Full = 'full'
}

export type Landing = { ok: true; piece: MotionDoc; boards: string[]; parent: string | null } | { ok: false; error: string; detail?: string };

export type Landed = { outcome: LandOutcome.Landed; boards: string[] } | { outcome: LandOutcome.Failed | LandOutcome.Full; error: string; detail?: string };

export type LandSession = {
  history: { present: MotionDoc };
  showPending: (root: MotionDoc, summary: string) => void;
  edit: (next: MotionDoc, summary: string) => void;
};

type Size = { width: number; height: number };

export type LandAsk = { label: string; map: ImportMap | null; size: Size; newId: NewId; fetch: () => Promise<Landing>; resized: (from: Size, to: Size) => void };


function without(doc: MotionDoc, id: string): MotionDoc {
  const removed = removeClips(doc, [id]);
  return removed.ok ? removed.doc : doc;
}

const sizeOf = (doc: MotionDoc): Size => ({ width: doc.width, height: doc.height });

function shown(session: LandSession, ask: LandAsk, next: MotionDoc, show: (doc: MotionDoc) => void) {
  const from = sizeOf(session.history.present);
  show(next);
  if (from.width !== next.width || from.height !== next.height) {
    ask.resized(from, sizeOf(next));
  }
}

export async function landImport(session: LandSession, ask: LandAsk): Promise<Landed> {
  const clean = session.history.present;
  const parent = boardParent(clean, ask.map);
  const id = ask.newId();
  const held = addBoards(clean, placeholderOf(clean, ask.label, ask.size, id), [id], parent, ask.newId);
  if (!held.ok) {
    return { outcome: LandOutcome.Full, error: held.refusal, detail: held.detail };
  }
  const pending = `Importing ${ask.label}`;
  const hold = (doc: MotionDoc) => session.showPending(doc, pending);
  shown(session, ask, held.doc, hold);

  const answer = await ask.fetch().catch((): Landing => ({ ok: false, error: 'unavailable' }));
  const now = session.history.present;
  const base = now === held.doc ? clean : without(now, held.boards[id]);
  shown(session, ask, base, hold);
  if (!answer.ok) {
    return { outcome: LandOutcome.Failed, error: answer.error, ...(answer.detail ? { detail: answer.detail } : {}) };
  }

  const landed = addBoards(base, answer.piece, answer.boards, answer.parent ?? parent, ask.newId);
  if (!landed.ok) {
    return { outcome: LandOutcome.Full, error: landed.refusal, detail: landed.detail };
  }
  shown(session, ask, landed.doc, (doc) => session.edit(doc, `Imported ${ask.label}`));
  const boards = answer.boards.map((b) => landed.boards[b]);
  return { outcome: LandOutcome.Landed, boards };
}
