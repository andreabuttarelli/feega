import type { FrameDraft } from '$lib/motion/frame-sync';
import { SendResult } from './save-scheduler';

export type DraftEntry = FrameDraft & { id: string; nodeId: string };

export type DraftLog = {
  keep: (id: string, nodeId: string, draft: FrameDraft | null) => void;
  drop: (id: string) => void;
  all: () => DraftEntry[];
};

export function draftLog(start: DraftEntry[], save: (entries: DraftEntry[]) => void): DraftLog {
  let entries = [...start];

  const store = (next: DraftEntry[]) => {
    entries = next;
    save(entries);
  };

  function keep(id: string, nodeId: string, draft: FrameDraft | null) {
    const at = entries.findIndex((entry) => entry.id === id);
    if (!draft) {
      if (at >= 0) {
        store(entries.filter((entry) => entry.id !== id));
      }
      return;
    }
    const entry = { id, nodeId, ...draft };
    store(at >= 0 ? entries.map((known) => (known.id === id ? entry : known)) : [...entries, entry]);
  }

  return {
    keep,
    drop: (id) => keep(id, '', null),
    all: () => entries
  };
}

export async function replayDrafts(log: DraftLog, left: readonly DraftEntry[], send: (entry: DraftEntry) => Promise<SendResult>): Promise<number> {
  let waiting = 0;
  for (const entry of left) {
    const result = await send(entry).catch(() => SendResult.Retry);
    if (result === SendResult.Retry) {
      waiting += 1;
      continue;
    }
    log.drop(entry.id);
  }
  return waiting;
}
