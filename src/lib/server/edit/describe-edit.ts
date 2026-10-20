import { z } from 'zod';
import { CANVAS_OPS } from '$lib/server/canvas/canvas-ops';
import { CANVAS_OP_SUMMARIES } from '$lib/server/canvas/canvas-op-summaries';
import { EDITOR_OPS } from '$lib/server/frame-editor/editor-ops';
import { EDITOR_OP_SUMMARIES } from '$lib/server/frame-editor/editor-op-summaries';
import { SPENDING_TOOLS, motionToolList, motionToolSpec } from '$lib/server/motion/tool-run';
import { Family, editCatalogue, type EditOp } from './edit-catalogue';

export const describeInput = z.object({ op: z.string().optional(), ops: z.array(z.string()).optional(), schemas: z.boolean().optional() }).strict();

export type DescribeInput = z.infer<typeof describeInput>;

type Entry = { name: string; family: Family; access: string; summary: string };

const SCHEMA_OPTIONS = { io: 'input', unrepresentable: 'any' } as const;

const frameSummaries = () => new Map(motionToolList().map((t) => [t.name, t.summary]));

function entryOf(op: EditOp, frames: Map<string, string>): Entry {
  if (op.family === Family.Canvas) {
    const found = CANVAS_OPS[op.source as keyof typeof CANVAS_OPS];
    return { name: op.name, family: op.family, access: found.access, summary: CANVAS_OP_SUMMARIES[op.source as keyof typeof CANVAS_OP_SUMMARIES] };
  }
  if (op.family === Family.Editor) {
    const found = EDITOR_OPS[op.source as keyof typeof EDITOR_OPS];
    return { name: op.name, family: op.family, access: found.access, summary: EDITOR_OP_SUMMARIES[op.source as keyof typeof EDITOR_OP_SUMMARIES] };
  }
  return { name: op.name, family: op.family, access: SPENDING_TOOLS.has(op.source) ? 'spend' : 'write', summary: frames.get(op.source) ?? '' };
}

async function schemaOf(op: EditOp): Promise<unknown> {
  if (op.family === Family.Canvas) {
    return z.toJSONSchema(CANVAS_OPS[op.source as keyof typeof CANVAS_OPS].input, SCHEMA_OPTIONS);
  }
  if (op.family === Family.Editor) {
    return z.toJSONSchema(EDITOR_OPS[op.source as keyof typeof EDITOR_OPS].input, SCHEMA_OPTIONS);
  }
  return (await motionToolSpec(op.source))?.input_schema ?? null;
}

async function detail(op: EditOp, frames: Map<string, string>) {
  return { op: op.name, ...entryOf(op, frames), input_schema: await schemaOf(op) };
}

export async function describeInputKeys(op: EditOp): Promise<string[]> {
  const schema = (await schemaOf(op)) as { properties?: Record<string, unknown> } | null;
  return Object.keys(schema?.properties ?? {});
}

export async function describeEdit(asked: DescribeInput) {
  const catalogue = editCatalogue();
  const frames = frameSummaries();
  const unknown = (names: string[]) => ({ error: 'unknown_op', fix: 'Call op "describe" with {} for the list.', ops: names.length ? names : [...catalogue.keys()] });

  if (asked.op !== undefined) {
    const found = catalogue.get(asked.op);
    return found ? detail(found, frames) : unknown([]);
  }
  if (asked.ops) {
    const missing = asked.ops.filter((n) => !catalogue.has(n));
    return missing.length ? { ...unknown([]), unknown: missing } : { schemas: await Promise.all(asked.ops.map((n) => detail(catalogue.get(n)!, frames))) };
  }
  if (asked.schemas) {
    return { schemas: await Promise.all([...catalogue.values()].map((o) => detail(o, frames))) };
  }
  return { ops: [...catalogue.values()].map((o) => entryOf(o, frames)) };
}
