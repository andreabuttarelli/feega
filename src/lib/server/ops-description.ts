import { z } from 'zod';

type DescribableOp = { access: string; input: z.ZodType };

export type OpSummaries<R> = Record<keyof R & string, string>;

export function describeOps<R extends Record<string, DescribableOp>>(registry: R, summaries: OpSummaries<R>, name: string | undefined) {
  const names = Object.keys(registry) as Array<keyof R & string>;
  if (name === undefined) {
    return { ops: names.map((n) => ({ name: n, access: registry[n].access, summary: summaries[n] })) };
  }
  if (!Object.hasOwn(registry, name)) {
    return { error: 'unknown_op', fix: 'Call op "describe" with {} for the list, or {op} for one input schema.', ops: names };
  }
  const found = registry[name];
  return { op: name, access: found.access, summary: summaries[name as keyof R & string], input_schema: z.toJSONSchema(found.input, { io: 'input', unrepresentable: 'any' }) };
}
