import type { MotionDoc } from '$lib/motion/doc';
import type { DocOp } from '$lib/motion/doc-ops';
import { landed, outgoing, type Revision } from '$lib/motion/frame-sync';

export const SAVE_DEBOUNCE_MS = 250;

export type Outgoing = { ops: DocOp[]; version: number; summary: string };
export type Send = (sent: Outgoing) => Promise<Revision | null>;

export function frameSaver(head: Revision, send: Send, delay = SAVE_DEBOUNCE_MS, onpresent: (doc: MotionDoc) => void = () => {}) {
  let base = head;
  let present = head.doc;
  let summary = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saving: Promise<void> | null = null;
  let again = false;

  async function run() {
    const sent = present;
    const server = await send({ ops: outgoing(base, sent), version: base.version, summary });
    if (!server) {
      return;
    }
    const next = landed(base, sent, present, server);
    base = next.base;
    if (next.present !== present) {
      present = next.present;
      onpresent(present);
    }
  }

  async function save() {
    if (saving) {
      again = true;
      return saving;
    }
    saving = run().finally(() => (saving = null));
    await saving;
    if (again) {
      again = false;
      await save();
    }
  }

  return {
    get doc() {
      return present;
    },
    get version() {
      return base.version;
    },
    apply(doc: MotionDoc, why: string) {
      present = doc;
      summary = why;
      onpresent(doc);
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => void save(), delay);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await save();
    }
  };
}
