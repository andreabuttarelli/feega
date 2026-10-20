import type { CanvasOpName } from '$lib/server/canvas/canvas-ops';
import type { EditorOpName } from '$lib/server/frame-editor/editor-ops';
import { Family, type EditOp } from './edit-catalogue';
import type { Answer, CanvasAsk, EditorAsk, FrameToolAsk } from './runners';

export type EditStep = { op: string; target?: string; element?: string; input?: Record<string, unknown>; version?: number };

export type EditAsk = { projectId?: string; steps: EditStep[]; batch?: boolean };

export type EditPorts = {
  catalogue: Map<string, EditOp>;
  inputKeys: (op: EditOp) => Promise<string[]>;
  projectOf: (nodeId: string) => Promise<string | null>;
  canvas: (ask: CanvasAsk) => Promise<Answer>;
  frame: (ask: FrameToolAsk) => Promise<Answer>;
  editor: (ask: EditorAsk) => Promise<Answer>;
};

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const FRAME_BATCH = 'batch';

const TARGET_KEYS = ['nodeId', 'frameId'];

const ELEMENT_FILL: Record<string, (id: string) => unknown> = {
  elementId: (id) => id,
  clip_id: (id) => id,
  clip_ids: (id) => [id]
};

const refusal = (error: string, extra: Record<string, unknown> = {}): Answer => ({ status: HTTP_BAD_REQUEST, body: { error, ...extra } });

const succeeded = (answer: Answer) => answer.status >= HTTP_OK && answer.status < HTTP_OK + 100;

async function filled(ports: EditPorts, op: EditOp, step: EditStep): Promise<Record<string, unknown>> {
  const input = { ...step.input };
  if (!step.target && !step.element) {
    return input;
  }
  const keys = await ports.inputKeys(op);
  const targetKey = op.family === Family.Canvas ? TARGET_KEYS.find((k) => keys.includes(k)) : undefined;
  if (step.target && targetKey && input[targetKey] === undefined) {
    input[targetKey] = step.target;
  }
  const elementKey = Object.keys(ELEMENT_FILL).find((k) => keys.includes(k));
  if (step.element && elementKey && input[elementKey] === undefined) {
    input[elementKey] = ELEMENT_FILL[elementKey](step.element);
  }
  return input;
}

type Resolved = { op: EditOp; step: EditStep; input: Record<string, unknown> };

async function resolved(ports: EditPorts, step: EditStep): Promise<Resolved | Answer> {
  const op = ports.catalogue.get(step.op);
  if (!op) {
    return refusal('unknown_op', { op: step.op, fix: 'Call op "describe" for the list.' });
  }
  if (op.family !== Family.Canvas && !step.target) {
    return refusal('target_required', { op: step.op, fix: 'Pass `target`: the id of the frame this op edits.' });
  }
  return { op, step, input: await filled(ports, op, step) };
}

const isAnswer = (r: Resolved | Answer): r is Answer => 'status' in r;

async function projectFor(ports: EditPorts, ask: EditAsk, r: Resolved): Promise<string | null> {
  return ask.projectId ?? (r.step.target ? await ports.projectOf(r.step.target) : null);
}

async function runOne(ports: EditPorts, ask: EditAsk, r: Resolved): Promise<Answer> {
  if (r.op.family === Family.Frame) {
    return ports.frame({ nodeId: r.step.target ?? '', tool: r.op.source, input: r.input, version: r.step.version });
  }
  if (r.op.family === Family.Editor) {
    return ports.editor({ nodeId: r.step.target ?? '', op: r.op.source as EditorOpName, input: r.input });
  }
  const projectId = await projectFor(ports, ask, r);
  if (!projectId) {
    return refusal('project_required', { op: r.step.op, fix: 'Pass `project_id`, or a `target` node id of that project.' });
  }
  return ports.canvas({ projectId, op: r.op.source as CanvasOpName, input: r.input });
}

type Group = { items: Resolved[]; first: number };

function grouped(all: Resolved[]): Group[] {
  const groups: Group[] = [];
  for (const [index, r] of all.entries()) {
    const last = groups.at(-1);
    const joins = last && r.op.family === Family.Frame && last.items[0].op.family === Family.Frame && last.items[0].step.target === r.step.target;
    if (joins) {
      last.items.push(r);
      continue;
    }
    groups.push({ items: [r], first: index });
  }
  return groups;
}

async function runGroup(ports: EditPorts, ask: EditAsk, group: Group): Promise<Answer> {
  if (group.items.length === 1) {
    return runOne(ports, ask, group.items[0]);
  }
  const ops = group.items.map((r) => ({ tool: r.op.source, input: r.input }));
  return ports.frame({ nodeId: group.items[0].step.target ?? '', tool: FRAME_BATCH, input: { ops }, version: group.items[0].step.version });
}

function resultsOf(group: Group, answer: Answer) {
  const outputs = ((answer.body as { output?: { results?: unknown[] } }).output?.results ?? []) as unknown[];
  return group.items.map((r, i) => ({
    index: group.first + i,
    op: r.step.op,
    status: answer.status,
    body: group.items.length > 1 ? { ...(answer.body as object), output: outputs[i] } : answer.body
  }));
}

export async function runEdit(ports: EditPorts, ask: EditAsk): Promise<Answer> {
  const isBatch = (ask.batch ?? ask.steps.length > 1);
  const all: Resolved[] = [];
  for (const [index, step] of ask.steps.entries()) {
    const r = await resolved(ports, step);
    if (isAnswer(r)) {
      return { ...r, body: { ...(r.body as object), index } };
    }
    all.push(r);
  }
  if (!isBatch) {
    return runOne(ports, ask, all[0]);
  }

  const results: ReturnType<typeof resultsOf> = [];
  for (const group of grouped(all)) {
    const answer = await runGroup(ports, ask, group);
    if (!succeeded(answer)) {
      const inside = (answer.body as { index?: number }).index ?? 0;
      return { status: answer.status, body: { applied: results.length, failed: group.first + inside, error: answer.body, results } };
    }
    results.push(...resultsOf(group, answer));
  }
  return { status: HTTP_OK, body: { applied: results.length, results } };
}
