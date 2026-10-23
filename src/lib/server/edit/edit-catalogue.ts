import { z } from 'zod';
import { CANVAS_OPS, type CanvasOpName } from '$lib/server/canvas/canvas-ops';
import { CANVAS_OP_SUMMARIES } from '$lib/server/canvas/canvas-op-summaries';
import { EDITOR_OPS, type EditorOpName } from '$lib/server/frame-editor/editor-ops';
import { EDITOR_OP_SUMMARIES } from '$lib/server/frame-editor/editor-op-summaries';
import { SPENDING_TOOLS, motionToolList, motionToolSpec } from '$lib/server/motion/tool-run';
import type { Answer, CanvasAsk, EditorAsk, FrameToolAsk } from './runners';

export enum Family {
  Canvas = 'canvas',
  Frame = 'frame',
  Editor = 'editor'
}

export type Runners = {
  canvas: (ask: CanvasAsk) => Promise<Answer>;
  frame: (ask: FrameToolAsk) => Promise<Answer>;
  editor: (ask: EditorAsk) => Promise<Answer>;
};

export type RunAsk = { nodeId: string; input: Record<string, unknown>; version?: number; projectId: () => Promise<string | null> };

export type OpRow = {
  access: string;
  summary: string;
  schema: () => Promise<unknown>;
  run: (runners: Runners, ask: RunAsk) => Promise<Answer>;
};

export type EditOp = OpRow & { name: string; family: Family; source: string };

export const RESERVED_OPS = ['describe', 'batch'];

const PRECEDENCE = [Family.Canvas, Family.Frame, Family.Editor];

const SCHEMA_OPTIONS = { io: 'input', unrepresentable: 'any' } as const;

const HTTP_BAD_REQUEST = 400;

type RowOf = (name: string, source: string) => OpRow;

const canvasRow: RowOf = (name, source) => {
  const op = CANVAS_OPS[source as CanvasOpName];
  return {
    access: op.access,
    summary: CANVAS_OP_SUMMARIES[source as keyof typeof CANVAS_OP_SUMMARIES],
    schema: async () => z.toJSONSchema(op.input, SCHEMA_OPTIONS),
    run: async (runners, ask) => {
      const projectId = await ask.projectId();
      if (!projectId) {
        return { status: HTTP_BAD_REQUEST, body: { error: 'project_required', op: name, fix: 'Pass `project_id`, or a `target` node id of that project.' } };
      }
      return runners.canvas({ projectId, op: source as CanvasOpName, input: ask.input });
    }
  };
};

const frameRowOf = (): RowOf => {
  const summaries = new Map(motionToolList().map((t) => [t.name, t.summary]));
  return (_name, source) => ({
    access: SPENDING_TOOLS.has(source) ? 'spend' : 'write',
    summary: summaries.get(source) ?? '',
    schema: async () => (await motionToolSpec(source))?.input_schema ?? null,
    run: (runners, ask) => runners.frame({ nodeId: ask.nodeId, tool: source, input: ask.input, version: ask.version })
  });
};

const editorRow: RowOf = (_name, source) => {
  const op = EDITOR_OPS[source as EditorOpName];
  return {
    access: op.access,
    summary: EDITOR_OP_SUMMARIES[source as keyof typeof EDITOR_OP_SUMMARIES],
    schema: async () => z.toJSONSchema(op.input, SCHEMA_OPTIONS),
    run: (runners, ask) => runners.editor({ nodeId: ask.nodeId, op: source as EditorOpName, input: ask.input })
  };
};

const liveRows = (): Record<Family, RowOf> => ({
  [Family.Canvas]: canvasRow,
  [Family.Frame]: frameRowOf(),
  [Family.Editor]: editorRow
});

export function buildCatalogue(names: Record<Family, string[]>, rows: Record<Family, RowOf> = liveRows()): Map<string, EditOp> {
  const catalogue = new Map<string, EditOp>();
  for (const family of PRECEDENCE) {
    for (const source of names[family]) {
      const name = catalogue.has(source) ? `${family}_${source}` : source;
      catalogue.set(name, { name, family, source, ...rows[family](name, source) });
    }
  }
  return catalogue;
}

let built: Map<string, EditOp> | null = null;

export function editCatalogue(): Map<string, EditOp> {
  built ??= buildCatalogue({
    [Family.Canvas]: Object.keys(CANVAS_OPS),
    [Family.Frame]: motionToolList().map((t) => t.name),
    [Family.Editor]: Object.keys(EDITOR_OPS)
  });
  return built;
}
