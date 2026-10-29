export type SentOp = { id: string; action: string; fields: Record<string, string> };

export type SentLog = { add: (op: SentOp) => void; drop: (id: string) => void; all: () => SentOp[] };

export function sentLog(start: SentOp[], save: (ops: SentOp[]) => void): SentLog {
  let ops = [...start];
  const keep = (next: SentOp[]) => {
    ops = next;
    save(ops);
  };
  return {
    add: (op) => keep([...ops, op]),
    drop: (id) => keep(ops.filter((op) => op.id !== id)),
    all: () => ops
  };
}

export async function replaySent(log: SentLog, left: readonly SentOp[], post: (action: string, fields: Record<string, string>) => Promise<unknown>): Promise<void> {
  for (const op of left) {
    await post(op.action, op.fields).catch(() => null);
    log.drop(op.id);
  }
}
