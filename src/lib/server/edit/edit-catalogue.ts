import { CANVAS_OPS } from '$lib/server/canvas/canvas-ops';
import { EDITOR_OPS } from '$lib/server/frame-editor/editor-ops';
import { motionToolList } from '$lib/server/motion/tool-run';

export enum Family {
  Canvas = 'canvas',
  Frame = 'frame',
  Editor = 'editor'
}

export type EditOp = { name: string; family: Family; source: string };

export const RESERVED_OPS = ['describe', 'batch'];

const PRECEDENCE = [Family.Canvas, Family.Frame, Family.Editor];

export function buildCatalogue(names: Record<Family, string[]>): Map<string, EditOp> {
  const catalogue = new Map<string, EditOp>();
  for (const family of PRECEDENCE) {
    for (const source of names[family]) {
      const name = catalogue.has(source) ? `${family}_${source}` : source;
      catalogue.set(name, { name, family, source });
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
