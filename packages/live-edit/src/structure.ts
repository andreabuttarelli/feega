import { offsetOf, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import type { TextWritten } from './literal-text';
import { moveInto, type Structured } from './move-into';
import { addNode, type AddRequest, type AddStyle } from './add-node';
import { ItemOp, loopItem } from './loop-items';
import { loopsAt } from './loop-array';
import { moveLoopItem, type LoopMove } from './move-loop-item';
import { WrapTag, unwrapNode, wrapNode } from './wrap-node';
import { moveUsage, type Usage } from './move-usage';
import { hiddenOut, lineSpan, parentOf, repeated, spanOf, type Span } from './move-node';

type Found = { source: string; whole: Span };

type Refused = { reason: string; at?: LiveAt };

async function found(read: ReadFile, at: LiveAt): Promise<Found | Refused> {
  const source = await read(at.file);
  if (source === null) {
    return { reason: `${at.file}: cannot read the file` };
  }

  const text = hiddenOut(source);
  const span = spanOf(text, offsetOf(text, at));
  if (!span) {
    return { reason: `${at.file}: the element is not where the page says` };
  }

  const why = repeated(text, parentOf(text, span.start), span.start);
  if (why) {
    return { reason: why, at };
  }

  return { source, whole: lineSpan(source, span) };
}

async function rewritten(read: ReadFile, at: LiveAt, rewrite: (source: string, whole: Span) => string): Promise<TextWritten> {
  const out = await found(read, at);
  if ('reason' in out) {
    return { ok: false, ...out };
  }

  return { ok: true, change: { path: at.file, before: out.source, after: rewrite(out.source, out.whole) } };
}

function copied(source: string, whole: Span): string {
  const piece = source.slice(whole.start, whole.end);
  const glue = piece.endsWith('\n') ? '' : '\n';
  return source.slice(0, whole.end) + glue + piece + source.slice(whole.end);
}

export const deleteNode = (read: ReadFile, at: LiveAt) => rewritten(read, at, (source, whole) => source.slice(0, whole.start) + source.slice(whole.end));

export const duplicateNode = (read: ReadFile, at: LiveAt) => rewritten(read, at, copied);

export enum StructureOp {
  Delete = 'delete',
  Duplicate = 'duplicate',
  MoveInto = 'move-into',
  MoveUsage = 'move-usage',
  MoveLoopItem = 'move-loop-item',
  AddItem = 'add-item',
  Add = 'add',
  Wrap = 'wrap',
  Unwrap = 'unwrap'
}

export type StructureRequest = { op: StructureOp; at: LiveAt; to?: LiveAt; usage?: Usage; loop?: LoopMove; instance?: number; add?: AddRequest; style?: AddStyle; wrap?: WrapTag };

const single = (out: TextWritten): Structured => (out.ok ? { ok: true, changes: [out.change] } : out);

const OPS: Record<StructureOp, (read: ReadFile, req: StructureRequest) => Promise<Structured>> = {
  [StructureOp.Delete]: async (read, req) => single(await deleteNode(read, req.at)),
  [StructureOp.Duplicate]: async (read, req) => single(await duplicateNode(read, req.at)),
  [StructureOp.MoveUsage]: async (read, req) => (req.usage ? moveUsage(read, req.at.file, req.usage) : { ok: false, reason: 'no component usages given' }),
  [StructureOp.MoveLoopItem]: async (read, req) => (req.loop ? moveLoopItem(read, req.at, req.loop) : { ok: false, reason: 'no item positions given' }),
  [StructureOp.AddItem]: (read, req) => loopItem(read, req.at, req.instance, ItemOp.Append),
  [StructureOp.Add]: async (read, req) => (req.add ? addNode(read, req.at, req.add) : { ok: false, reason: 'nothing to add' }),
  [StructureOp.Wrap]: (read, req) => wrapNode(read, req.at, req.style, req.wrap),
  [StructureOp.Unwrap]: (read, req) => unwrapNode(read, req.at, req.style, req.wrap),
  [StructureOp.MoveInto]: async (read, req) => (req.to ? moveInto(read, req.at, req.to) : { ok: false, reason: 'no target container' })
};

const LOOP_ITEM_OPS: Partial<Record<StructureOp, ItemOp>> = {
  [StructureOp.Duplicate]: ItemOp.Duplicate,
  [StructureOp.Delete]: ItemOp.Delete
};

async function rootsLoop(read: ReadFile, at: LiveAt): Promise<boolean> {
  const source = await read(at.file);
  if (source === null) {
    return false;
  }

  const text = hiddenOut(source);
  const span = spanOf(text, offsetOf(text, at));
  return span !== null && (repeated(text, parentOf(text, span.start), span.start) !== null || loopsAt(text, span.start).some((head) => head.at === span.start));
}

export async function structure(read: ReadFile, req: StructureRequest): Promise<Structured> {
  const item = LOOP_ITEM_OPS[req.op];
  if (item && (await rootsLoop(read, req.at))) {
    return loopItem(read, req.at, req.instance, item);
  }
  return OPS[req.op](read, req);
}
