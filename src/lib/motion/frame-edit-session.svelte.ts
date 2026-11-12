import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { applyOps, rebase, type DocOp } from './doc-ops';
import type { PeerStep } from './frame-step';
import { EditMode } from './edit-mode';
import { SaveState } from './editor-bar';
import { landed, outgoing, remote, type FrameDraft, type Revision, type Synced } from './frame-sync';
import { adoptHead, amend, followHead, record, redo, startHistory, undo, type History } from './history';
import { liveEdits, type LiveEdits } from './live-edit';
import { settleGroups } from './light-group';
import { mergeView } from '@feega/motion-core/motion/precomp';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { BASE_BREAKPOINT } from '@feega/motion-core/motion/breakpoints/model';

const SAVE_DEBOUNCE_MS = 250;
const DRAFT_AFTER_MS = 50;
const COALESCE_MS = 800;
const RETRY_FIRST_MS = 1000;
const RETRY_CAP_MS = 30000;

export enum Delivery {
  Refused = 'refused',
  Unreachable = 'unreachable',
  Conflict = 'conflict'
}

export type SendResult = { ok: true; version: number; doc: MotionDoc | undefined } | { ok: false; error: string; delivery?: Delivery; head?: Revision };

const UNREACHABLE: SendResult = { ok: false, error: 'offline', delivery: Delivery.Unreachable };

const retryDelay = (failures: number) => Math.min(RETRY_CAP_MS, RETRY_FIRST_MS * 2 ** (failures - 1));

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
  draft: (draft: FrameDraft | null) => void;
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
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private idlers: (() => void)[] = [];
  private unsavedSummary = '';
  private failures = 0;
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

  showPending(root: MotionDoc, summary: string) {
    if (this.access === DocAccess.Read) {
      return;
    }
    this.port.recorded();
    this.history = followHead(this.history, root);
    this.port.show(this.history.present);
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
    this.draftSoon();
  }

  private draftSoon() {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
    }
    this.draftTimer = setTimeout(() => {
      this.draftTimer = null;
      this.keepDraft();
    }, DRAFT_AFTER_MS);
  }

  private keepDraft() {
    const ops = outgoing({ version: this.version, doc: this.baseDoc }, this.history.present);
    this.port.draft(ops.length ? { version: this.version, ops, summary: this.unsavedSummary } : null);
  }

  private retryLater() {
    this.failures += 1;
    this.resave = false;
    this.saveState = SaveState.Pending;
    this.saveTimer = setTimeout(() => void this.save(), retryDelay(this.failures));
    this.keepDraft();
  }

  unsaved(): boolean {
    return this.saveState === SaveState.Pending || this.saveState === SaveState.Saving;
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

  async settled(): Promise<void> {
    await this.flushScheduled();
    if (this.saving || this.saveState === SaveState.Pending) {
      await new Promise<void>((resolve) => this.idlers.push(resolve));
    }
  }

  private wake() {
    if (this.saving || this.saveState === SaveState.Pending) {
      return;
    }
    const waiting = this.idlers;
    this.idlers = [];
    waiting.forEach((resolve) => resolve());
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

  async rebaseOn(write: () => Promise<Revision | null>): Promise<Revision | null> {
    await this.settled();
    const written = write().then((head) => {
      if (head) {
        this.takeRemote(head);
      }
      return head;
    });
    this.holdSave(written);
    return written;
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
    const result = await this.port.send(outgoing(base, sent), this.version, this.unsavedSummary).catch(() => UNREACHABLE);
    this.saving = false;

    if (!result.ok && result.delivery === Delivery.Unreachable) {
      this.retryLater();
      return;
    }
    this.failures = 0;
    if (result.ok && result.doc) {
      this.port.landed(base, { version: result.version, doc: result.doc });
    }
    if (result.ok) {
      this.follow(landed(base, sent, this.history.present, { version: result.version, doc: result.doc as MotionDoc }));
      this.saveState = SaveState.Saved;
      this.keepDraft();
    } else if (result.head) {
      this.adopt(result.head);
      this.saveState = SaveState.Saved;
      this.notice = result.error;
      this.port.draft(null);
    } else {
      this.saveState = SaveState.Failed;
      this.notice = result.error;
      this.port.draft(null);
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
    this.wake();
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
