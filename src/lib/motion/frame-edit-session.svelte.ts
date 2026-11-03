import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { applyOps, rebase, type DocOp } from './doc-ops';
import type { PeerStep } from './frame-step';
import { EditMode } from './edit-mode';
import { SaveState } from './editor-bar';
import { landed, outgoing, remote, type Revision, type Synced } from './frame-sync';
import { adoptHead, amend, followHead, record, redo, startHistory, undo, type History } from './history';
import { liveEdits, type LiveEdits } from './live-edit';
import { settleGroups } from './light-group';
import { mergeView } from '@feega/motion-core/motion/precomp';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { BASE_BREAKPOINT } from '@feega/motion-core/motion/breakpoints/model';

const SAVE_DEBOUNCE_MS = 250;
const COALESCE_MS = 800;
const RETRY_FIRST_MS = 1_000;
const RETRY_LONGEST_MS = 30_000;
const UNREACHABLE = 'Could not reach the server: retrying';
const RESTORED = 'Restored unsaved edits';

export enum SaveFailure {
  Transient = 'transient',
  Refused = 'refused'
}

export type SendResult = { ok: true; version: number; doc: MotionDoc | undefined } | { ok: false; error: string; failure: SaveFailure };

export type FrameDraft = { version: number; ops: DocOp[] };

const retryDelay = (failures: number) => Math.min(RETRY_LONGEST_MS, RETRY_FIRST_MS * 2 ** (failures - 1));

export type SessionPort = {
  viewPath: () => string[];
  show: (doc: MotionDoc | null) => void;
  recorded: () => void;
  stepped: () => void;
  playhead: () => number;
  saved: (head: Revision) => void;
  landed: (from: Revision, to: Revision) => void;
  pull: () => Promise<void>;
  send: (ops: DocOp[], version: number, summary: string) => Promise<SendResult>;
  refused: (error: string) => void;
  keep: (draft: FrameDraft) => void;
  release: () => void;
};

export enum DocAccess {
  Write = 'write',
  Read = 'read'
}

export type SessionStart = { head: Revision; selection: string[]; mode?: EditMode };

export class FrameEditSession {
  history = $state.raw<History>(startHistory({} as MotionDoc));
  version = $state(0);
  selection = $state<string[]>([]);
  breakpoint = $state<string>(BASE_BREAKPOINT);
  mode = $state<EditMode>(EditMode.Design);
  access = $state<DocAccess>(DocAccess.Write);
  saveState = $state<SaveState>(SaveState.Saved);
  notice = $state('');
  readonly live: LiveEdits<MotionDoc>;

  private baseDoc: MotionDoc;
  private saving = false;
  private resave = false;
  private missedRemote = false;
  private held: Promise<unknown> | null = null;
  private lastEdit = { summary: '', at: 0 };
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private unsavedSummary = '';
  private readonly port: SessionPort;

  constructor(start: SessionStart, port: SessionPort) {
    this.port = port;
    this.history = startHistory(start.head.doc);
    this.version = start.head.version;
    this.selection = start.selection;
    this.mode = start.mode ?? EditMode.Design;
    this.baseDoc = start.head.doc;
    this.live = liveEdits<MotionDoc>({
      show: (next) => this.port.show(next),
      record: (next, summary) => this.recordEdit(next, summary)
    });
  }

  get playhead(): number {
    return this.port.playhead();
  }

  select(ids: string[]) {
    this.selection = ids;
  }

  edit(next: MotionDoc, summary: string) {
    if (this.access === DocAccess.Read) {
      return;
    }
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
    if (this.access === DocAccess.Read) {
      return;
    }
    this.port.recorded();
    const now = Date.now();
    const root = settleGroups(mergeView(this.history.present, this.port.viewPath(), next));
    const typedOn = summary === this.lastEdit.summary && now - this.lastEdit.at < COALESCE_MS;
    this.history = typedOn ? amend(this.history, root) : record(this.history, root);
    this.port.show(this.history.present);
    if (!typedOn) {
      this.port.stepped();
    }
    this.lastEdit = { summary, at: now };
    this.scheduleSave(summary);
  }

  settleHeld(root: MotionDoc) {
    this.history = amend(this.history, root);
  }

  adoptSaved(root: MotionDoc) {
    this.baseDoc = rebase(this.history.present, root, this.baseDoc);
    this.history = amend(this.history, root);
  }

  amendRoot(root: MotionDoc, summary: string) {
    if (this.access === DocAccess.Read) {
      return;
    }
    this.history = amend(this.history, root);
    this.scheduleSave(summary);
  }

  recordRoot(root: MotionDoc, summary: string) {
    if (this.access === DocAccess.Read) {
      return;
    }
    this.history = record(this.history, root);
    this.port.stepped();
    this.scheduleSave(summary);
  }

  undo() {
    if (this.access === DocAccess.Read) {
      return;
    }
    this.history = undo(this.history);
    this.scheduleSave('Undo');
  }

  redo() {
    if (this.access === DocAccess.Read) {
      return;
    }
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

  unsaved(): boolean {
    return this.saveState !== SaveState.Saved;
  }

  restore(draft: FrameDraft): boolean {
    if (draft.version !== this.version || !draft.ops.length) {
      return false;
    }
    this.recordRoot(applyOps(this.history.present, draft.ops), RESTORED);
    return true;
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

  followStep(step: PeerStep): boolean {
    if (step.base !== this.version) {
      return false;
    }
    return this.takeRemote({ version: step.version, doc: applyOps(this.baseDoc, step.ops) });
  }

  holdSave(until: Promise<unknown>) {
    const hold = until.catch(() => undefined).finally(() => {
      if (this.held === hold) {
        this.held = null;
      }
    });
    this.held = hold;
  }

  async save() {
    if (this.held) {
      await this.held;
      if (this.saving || this.saveState !== SaveState.Pending) {
        return;
      }
    }
    if (this.saving) {
      this.resave = true;
      return;
    }
    this.saving = true;
    this.saveState = SaveState.Saving;
    const sent = this.history.present;
    const base = { version: this.version, doc: this.baseDoc };
    const ops = outgoing(base, sent);
    this.port.keep({ version: base.version, ops });
    const result = await this.port.send(ops, this.version, this.unsavedSummary).catch((): SendResult => ({ ok: false, error: UNREACHABLE, failure: SaveFailure.Transient }));
    this.saving = false;

    if (result.ok && result.doc) {
      this.port.landed(base, { version: result.version, doc: result.doc });
    }
    if (result.ok) {
      this.failures = 0;
      this.follow(landed(base, sent, this.history.present, { version: result.version, doc: result.doc as MotionDoc }));
      this.saveState = SaveState.Saved;
      this.port.release();
    } else {
      this.failed(result.error, result.failure);
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

  private failed(error: string, failure: SaveFailure) {
    if (failure === SaveFailure.Transient) {
      this.failures += 1;
      this.saveState = SaveState.Pending;
      this.notice = error;
      this.saveTimer = setTimeout(() => void this.save(), retryDelay(this.failures));
      return;
    }
    this.saveState = SaveState.Failed;
    this.notice = error;
    this.port.refused(error);
  }

  private follow(next: Synced) {
    this.baseDoc = next.base.doc;
    this.version = next.base.version;
    if (next.present !== this.history.present) {
      this.history = followHead(this.history, next.present);
      this.selection = this.selection.filter((id) => findClip(next.present, id));
    }
    this.port.saved(next.base);
  }
}
