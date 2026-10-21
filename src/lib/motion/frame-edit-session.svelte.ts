import { findClip, type MotionDoc } from './doc';
import type { DocOp } from './doc-ops';
import { SaveState } from './editor-bar';
import { landed, outgoing, remote, type Revision, type Synced } from './frame-sync';
import { adoptHead, amend, followHead, record, redo, startHistory, undo, type History } from './history';
import { liveEdits, type LiveEdits } from './live-edit';
import { mergeView } from './precomp';
import type { OpResult } from './timeline';

const SAVE_DEBOUNCE_MS = 250;
const COALESCE_MS = 800;

export type SendResult = { ok: true; version: number; doc: MotionDoc | undefined } | { ok: false; error: string };

export type SessionPort = {
  viewPath: () => string[];
  show: (doc: MotionDoc | null) => void;
  recorded: () => void;
  saved: (head: Revision) => void;
  pull: () => Promise<void>;
  send: (ops: DocOp[], version: number, summary: string) => Promise<SendResult>;
};

export type SessionStart = { head: Revision; selection: string[] };

export class FrameEditSession {
  history = $state.raw<History>(startHistory({} as MotionDoc));
  version = $state(0);
  selection = $state<string[]>([]);
  saveState = $state<SaveState>(SaveState.Saved);
  notice = $state('');
  readonly live: LiveEdits<MotionDoc>;

  private baseDoc: MotionDoc;
  private saving = false;
  private resave = false;
  private missedRemote = false;
  private lastEdit = { summary: '', at: 0 };
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private unsavedSummary = '';
  private readonly port: SessionPort;

  constructor(start: SessionStart, port: SessionPort) {
    this.port = port;
    this.history = startHistory(start.head.doc);
    this.version = start.head.version;
    this.selection = start.selection;
    this.baseDoc = start.head.doc;
    this.live = liveEdits<MotionDoc>({
      show: (next) => this.port.show(next),
      record: (next, summary) => this.recordEdit(next, summary)
    });
  }

  select(ids: string[]) {
    this.selection = ids;
  }

  edit(next: MotionDoc, summary: string) {
    this.live.edit(next, summary);
  }

  apply(result: OpResult, summary: string) {
    if (!result.ok) {
      this.notice = result.error;
      return;
    }
    this.notice = '';
    this.edit(result.doc, summary);
  }

  recordEdit(next: MotionDoc, summary: string) {
    this.port.recorded();
    const now = Date.now();
    const root = mergeView(this.history.present, this.port.viewPath(), next);
    this.history = summary === this.lastEdit.summary && now - this.lastEdit.at < COALESCE_MS ? amend(this.history, root) : record(this.history, root);
    this.lastEdit = { summary, at: now };
    this.scheduleSave(summary);
  }

  amendRoot(root: MotionDoc, summary: string) {
    this.history = amend(this.history, root);
    this.scheduleSave(summary);
  }

  recordRoot(root: MotionDoc, summary: string) {
    this.history = record(this.history, root);
    this.scheduleSave(summary);
  }

  undo() {
    this.history = undo(this.history);
    this.scheduleSave('Undo');
  }

  redo() {
    this.history = redo(this.history);
    this.scheduleSave('Redo');
  }

  restart(head: Revision) {
    this.history = startHistory(head.doc);
    this.version = head.version;
  }

  scheduleSave(summary: string) {
    this.unsavedSummary = summary;
    this.saveState = SaveState.Pending;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => void this.save(), SAVE_DEBOUNCE_MS);
  }

  async flushPending() {
    if (this.saveState !== SaveState.Pending) {
      return;
    }
    clearTimeout(this.saveTimer ?? undefined);
    await this.save();
  }

  async flushScheduled() {
    if (!this.saveTimer) {
      return;
    }
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    await this.save();
  }

  adopt(head: Revision) {
    this.history = adoptHead(this.history, head.doc, this.version);
    this.baseDoc = head.doc;
    this.version = head.version;
    this.port.saved(head);
  }

  takeRemote(head: Revision | null): boolean {
    if (this.saving) {
      this.missedRemote = true;
      return false;
    }
    const next = head ? remote({ version: this.version, doc: this.baseDoc }, this.history.present, head) : null;
    if (next) {
      this.follow(next);
    }
    return next !== null;
  }

  async save() {
    if (this.saving) {
      this.resave = true;
      return;
    }
    this.saving = true;
    this.saveState = SaveState.Saving;
    const sent = this.history.present;
    const base = { version: this.version, doc: this.baseDoc };
    const result = await this.port.send(outgoing(base, sent), this.version, this.unsavedSummary);
    this.saving = false;

    if (result.ok) {
      this.follow(landed(base, sent, this.history.present, { version: result.version, doc: result.doc as MotionDoc }));
      this.saveState = SaveState.Saved;
    } else {
      this.saveState = SaveState.Failed;
      this.notice = result.error;
    }
    if (this.resave) {
      this.resave = false;
      await this.save();
      return;
    }
    if (this.missedRemote) {
      this.missedRemote = false;
      await this.port.pull();
    }
  }

  private follow(next: Synced) {
    this.baseDoc = next.base.doc;
    this.version = next.base.version;
    this.port.saved(next.base);
    if (next.present === this.history.present) {
      return;
    }
    this.history = followHead(this.history, next.present);
    this.selection = this.selection.filter((id) => findClip(next.present, id));
  }
}
