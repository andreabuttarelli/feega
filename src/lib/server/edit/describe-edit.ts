import { z } from 'zod';
import { Family, editCatalogue, type EditOp } from './edit-catalogue';

export const describeInput = z.object({ family: z.enum(Family).optional(), op: z.string().optional(), ops: z.array(z.string()).optional(), schemas: z.boolean().optional() }).strict();

export type DescribeInput = z.infer<typeof describeInput>;

type Entry = { name: string; family: Family; access: string; summary: string };

const FAMILY_ABOUT: Record<Family, string> = {
  [Family.Canvas]: 'nodes, connections, free elements, runs, comments of a canvas; needs project_id or a target node',
  [Family.Frame]: 'inside one frame (a motion video or still): clips, text, shapes, keyframes, shots, UI, components; target = frame node id',
  [Family.Editor]: 'editor actions on a frame: fonts, revisions, branches, selection; target = frame node id'
};

const ACCESS_LEGEND = 'read: free, changes nothing. write: free, changes the canvas. spend: costs credits. editor: needs a chat turn in the app, refused here.';

const BARE_FIX = 'Pass {family} for its op names, access and one line each; {op} or {ops:[...]} for exact input schemas.';

function familiesOf(ops: EditOp[]) {
  return Object.values(Family).map((family) => {
    const own = ops.filter((o) => o.family === family);
    const byAccess = Object.fromEntries([...new Set(own.map((o) => o.access))].map((a) => [a, own.filter((o) => o.access === a).length]));
    return { family, about: FAMILY_ABOUT[family], ops: own.length, access: byAccess };
  });
}

const SUMMARY_MAX = 80;

const brief = (summary = '') => (summary.length > SUMMARY_MAX ? `${summary.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : summary);

const familyEntry = (op: EditOp) => ({ name: op.name, access: op.access, summary: brief(op.summary) });

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
  if (asked.family) {
    return { family: asked.family, ops: [...catalogue.values()].filter((o) => o.family === asked.family).map(familyEntry) };
  }
  return { families: familiesOf([...catalogue.values()]), access: ACCESS_LEGEND, fix: BARE_FIX };
}
