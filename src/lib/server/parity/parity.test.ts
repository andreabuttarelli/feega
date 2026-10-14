import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACTIONS } from '$lib/motion/actions';
import { SELECTION_ACTIONS } from '$lib/canvas/selection-actions';
import { isCanvasOp } from '$lib/server/canvas/canvas-ops';
import { motionToolList } from '$lib/server/motion/tool-run';
import { CANVAS_PAGE_ACTIONS, EDITOR_ACTIONS, FRAME_PAGE_ACTIONS, PARITY_TABLES, SELECTION_TOOLBAR, type Parity, type Route } from './ui-actions';

const CANVAS_PAGE = 'src/routes/p/[projectId]/c/[canvasId]/+page.server.ts';
const FRAME_PAGE = 'src/routes/p/[projectId]/c/[canvasId]/motion/[nodeId]/+page.server.ts';
const MCP_DOCS = 'docs/mcp-tools.md';

const KNOWN_GAPS = [
  'CANVAS_PAGE_ACTIONS.voice_library',
  'CANVAS_PAGE_ACTIONS.voice_use_library',
  'CANVAS_PAGE_ACTIONS.voice_design',
  'CANVAS_PAGE_ACTIONS.voice_save',
  'CANVAS_PAGE_ACTIONS.voice_clone',
  'CANVAS_PAGE_ACTIONS.voice_delete',
  'CANVAS_PAGE_ACTIONS.upload',
  'FRAME_PAGE_ACTIONS.render'
];

function formActions(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const block = source.slice(source.indexOf('export const actions'));
  return [...block.matchAll(/^ {2}([A-Za-z_]+): async/gm)].map((m) => m[1]!);
}

const mcpTools = new Set([...readFileSync(MCP_DOCS, 'utf8').matchAll(/^### `([a-z_]+)`/gm)].map((m) => m[1]!));
const motionTools = new Set(motionToolList().map((t) => t.name));

const ROUTE_EXISTS: Record<string, (route: Route) => boolean> = {
  canvas: (route) => 'canvas' in route && isCanvasOp(route.canvas),
  motion: (route) => 'motion' in route && motionTools.has(route.motion),
  tool: (route) => 'tool' in route && mcpTools.has(route.tool)
};

const routeExists = (route: Route) => ROUTE_EXISTS[Object.keys(route)[0]!]!(route);

const rows = Object.entries(PARITY_TABLES).flatMap(([table, entries]) => Object.entries(entries as Record<string, Parity>).map(([id, parity]) => ({ key: `${table}.${id}`, parity })));

describe('every change a person makes in the app, an agent can make over MCP', () => {
  it('maps every action of the canvas page, or says why it is ui-only', () => {
    expect(formActions(CANVAS_PAGE).sort()).toEqual(Object.keys(CANVAS_PAGE_ACTIONS).sort());
  });

  it('maps every action of the frame editor page, or says why it is ui-only', () => {
    expect(formActions(FRAME_PAGE).sort()).toEqual(Object.keys(FRAME_PAGE_ACTIONS).sort());
  });

  it('maps every editor command and button', () => {
    expect(Object.keys(ACTIONS).sort()).toEqual(Object.keys(EDITOR_ACTIONS).sort());
  });

  it('maps every button of the canvas selection toolbar', () => {
    expect(SELECTION_ACTIONS.map((a) => a.id).sort()).toEqual(Object.keys(SELECTION_TOOLBAR).sort());
  });

  it('points only at routes the MCP server really has', () => {
    const missing = rows.filter((r) => 'route' in r.parity && !routeExists(r.parity.route)).map((r) => r.key);
    expect(missing).toEqual([]);
  });

  it('gives every ui-only and gap row a reason', () => {
    const silent = rows.filter((r) => ('uiOnly' in r.parity && !r.parity.uiOnly) || ('gap' in r.parity && !r.parity.gap)).map((r) => r.key);
    expect(silent).toEqual([]);
  });

  it('opens no new gap without changing this list on purpose', () => {
    expect(rows.filter((r) => 'gap' in r.parity).map((r) => r.key)).toEqual(KNOWN_GAPS);
  });
});
