import type { AddStyle } from './add-node';
import type { LiveAt } from './class-patch';
import type { FileChange, ReadFile } from './files';
import type { Structured } from './move-into';
import { StructureOp, structure } from './structure';
import { wrapNodes, type WrapTag } from './wrap-node';

export type Target = { at: LiveAt; instance?: number };

export type Skipped = { at: LiveAt; reason: string };

export type ManyRequest = { op: StructureOp; targets: Target[]; style?: AddStyle; wrap?: WrapTag };

export type Batched = { ok: true; changes: FileChange[]; skipped: Skipped[]; selected?: LiveAt; note?: string } | { ok: false; reason: string; at?: LiveAt };

const EACH_ELEMENT_OPS = new Set([StructureOp.Delete, StructureOp.Duplicate, StructureOp.Unwrap]);

const bottomUp = (a: Target, b: Target) => a.at.file.localeCompare(b.at.file) || b.at.line - a.at.line || b.at.col - a.at.col || (b.instance ?? 0) - (a.instance ?? 0);

const lineCount = (text: string) => text.split('\n').length;

function firstChangedLine(before: string, after: string): number {
  const shared = Math.min(before.length, after.length);
  let line = 1;
  for (let i = 0; i < shared && before[i] === after[i]; i++) {
    line += before[i] === '\n' ? 1 : 0;
  }
  return line;
}

function shifted(target: Target, change: FileChange): Target {
  if (target.at.file !== change.path || target.at.line <= firstChangedLine(change.before, change.after)) {
    return target;
  }
  return { ...target, at: { ...target.at, line: target.at.line + lineCount(change.after) - lineCount(change.before) } };
}

function merged(edits: Map<string, FileChange>, changes: FileChange[]) {
  for (const change of changes) {
    edits.set(change.path, { ...change, before: edits.get(change.path)?.before ?? change.before });
  }
}

async function eachElement(read: ReadFile, req: ManyRequest): Promise<Batched> {
  const edits = new Map<string, FileChange>();
  const current: ReadFile = async (path) => edits.get(path)?.after ?? read(path);
  const skipped: Skipped[] = [];
  const queue = [...req.targets].sort(bottomUp);
  let note: string | undefined;

  while (queue.length) {
    const target = queue.shift()!;
    const out = await structure(current, { op: req.op, at: target.at, instance: target.instance, style: req.style });
    if (!out.ok) {
      skipped.push({ at: target.at, reason: out.reason });
      continue;
    }

    merged(edits, out.changes);
    note ??= out.note;
    queue.forEach((rest, i) => (queue[i] = out.changes.reduce(shifted, rest)));
  }

  const changes = [...edits.values()].filter((c) => c.before !== c.after);
  if (!changes.length) {
    return { ok: false, reason: skipped[0]?.reason ?? 'nothing to change', at: skipped[0]?.at };
  }
  return { ok: true, changes, skipped, note };
}

const grouped = (out: Structured): Batched => (out.ok ? { ...out, skipped: [] } : out);

export async function structureMany(read: ReadFile, req: ManyRequest): Promise<Batched> {
  if (!req.targets.length) {
    return { ok: false, reason: 'nothing selected' };
  }
  if (req.op === StructureOp.Wrap) {
    return grouped(await wrapNodes(read, req.targets.map((t) => t.at), req.style, req.wrap));
  }
  if (!EACH_ELEMENT_OPS.has(req.op)) {
    return { ok: false, reason: `${req.op} works on one element at a time` };
  }
  return eachElement(read, req);
}
