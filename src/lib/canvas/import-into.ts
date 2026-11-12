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

export type LandAsk = { label: string; map: ImportMap | null; size: { width: number; height: number }; newId: NewId; fetch: () => Promise<Landing> };

const FULL = 'frame_full';

function without(doc: MotionDoc, id: string): MotionDoc {
  const removed = removeClips(doc, [id]);
  return removed.ok ? removed.doc : doc;
}

export async function landImport(session: LandSession, ask: LandAsk): Promise<Landed> {
  const clean = session.history.present;
  const parent = boardParent(clean, ask.map);
  const id = ask.newId();
  const shown = addBoards(clean, placeholderOf(clean, ask.label, ask.size, id), [id], parent, ask.newId);
  if (!shown.ok) {
    return { outcome: LandOutcome.Full, error: FULL, detail: shown.detail };
  }
  const pending = `Importing ${ask.label}`;
  session.showPending(shown.doc, pending);

  const answer = await ask.fetch().catch((): Landing => ({ ok: false, error: 'unavailable' }));
  const now = session.history.present;
  const base = now === shown.doc ? clean : without(now, shown.boards[id]);
  session.showPending(base, pending);
  if (!answer.ok) {
    return { outcome: LandOutcome.Failed, error: answer.error, ...(answer.detail ? { detail: answer.detail } : {}) };
  }

  const landed = addBoards(base, answer.piece, answer.boards, answer.parent ?? parent, ask.newId);
  if (!landed.ok) {
    return { outcome: LandOutcome.Full, error: FULL, detail: landed.detail };
  }
  session.edit(landed.doc, `Imported ${ask.label}`);
  const boards = answer.boards.map((b) => landed.boards[b]);
  return { outcome: LandOutcome.Landed, boards };
}
