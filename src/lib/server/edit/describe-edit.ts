import { z } from 'zod';
import { Family, editCatalogue, type EditOp } from './edit-catalogue';

export const describeInput = z.object({ op: z.string().optional(), ops: z.array(z.string()).optional(), schemas: z.boolean().optional() }).strict();

export type DescribeInput = z.infer<typeof describeInput>;

type Entry = { name: string; family: Family; access: string; summary: string };

const entryOf = (op: EditOp): Entry => ({ name: op.name, family: op.family, access: op.access, summary: op.summary });

async function detail(op: EditOp) {
  return { op: op.name, ...entryOf(op), input_schema: await op.schema() };
}

export async function describeInputKeys(op: EditOp): Promise<string[]> {
  const schema = (await op.schema()) as { properties?: Record<string, unknown> } | null;
  return Object.keys(schema?.properties ?? {});
}

export async function describeEdit(asked: DescribeInput) {
  const catalogue = editCatalogue();
  const unknown = (names: string[]) => ({ error: 'unknown_op', fix: 'Call op "describe" with {} for the list.', ops: names.length ? names : [...catalogue.keys()] });

  if (asked.op !== undefined) {
    const found = catalogue.get(asked.op);
    return found ? detail(found) : unknown([]);
  }
  if (asked.ops) {
    const missing = asked.ops.filter((n) => !catalogue.has(n));
    return missing.length ? { ...unknown([]), unknown: missing } : { schemas: await Promise.all(asked.ops.map((n) => detail(catalogue.get(n)!))) };
  }
  if (asked.schemas) {
    return { schemas: await Promise.all([...catalogue.values()].map((o) => detail(o))) };
  }
  return { ops: [...catalogue.values()].map((o) => entryOf(o)) };
}
