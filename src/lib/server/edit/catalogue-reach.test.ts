import { describe, it, expect } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { chatSendsOp } from '$lib/server/canvas/canvas-ops';
import { createProjectTools } from '$lib/server/project-agent/project-tools';
import { createFrameTools, FRAME_TOOL } from '$lib/server/project-agent/frame-tools';
import { PARITY_TABLES, type Route } from '$lib/server/parity/ui-actions';
import { Family, editCatalogue, type Runners } from './edit-catalogue';

const SCOPE = { orgId: 'o', projectId: 'p', userId: 'u' };
const CANVAS_TOOL = 'canvas_tool';

const { db } = fakeDb({});
const projectTools = createProjectTools({ db, ...SCOPE });
const frameTools = createFrameTools({ db, ...SCOPE, open: null, editor: null });

const chatNames = new Set(Object.keys(projectTools));
const canvasToolOps = String(projectTools[CANVAS_TOOL].description);
const frameToolOps = String(frameTools[FRAME_TOOL].description);

const WITHOUT_SUMMARY: string[] = [];

const rows = [...editCatalogue().values()];

const reachedByChat = (family: Family, source: string): boolean => {
  if (family === Family.Canvas) {
    return chatNames.has(source) || canvasToolOps.includes(`${source} {`);
  }
  if (family === Family.Frame) {
    return frameToolOps.includes(source);
  }
  return false;
};

const UNREACHED_BY_CHAT = rows.filter((r) => r.family === Family.Editor || (r.family === Family.Canvas && !chatSendsOp(r.source as never))).map((r) => r.name);

describe('every catalogue row is reachable', () => {
  it('from the canvas chat, except the rows the chat is not meant to send', () => {
    const lost = rows.filter((r) => !reachedByChat(r.family, r.source)).map((r) => r.name);

    expect(lost).toEqual(UNREACHED_BY_CHAT);
  });

  it('from MCP edit, by its own name, into the runner of its family', async () => {
    const reached: string[] = [];
    const runners: Runners = {
      canvas: async (ask) => (reached.push(`${Family.Canvas}:${ask.op}`), { status: 200, body: {} }),
      frame: async (ask) => (reached.push(`${Family.Frame}:${ask.tool}`), { status: 200, body: {} }),
      editor: async (ask) => (reached.push(`${Family.Editor}:${ask.op}`), { status: 200, body: {} })
    };

    for (const row of rows) {
      await row.run(runners, { nodeId: 'n', input: {}, projectId: async () => 'p' });
    }

    expect(reached).toEqual(rows.map((r) => `${r.family}:${r.source}`));
  });

  it('and every row says what it is, but the ones listed here', () => {
    const silent = rows.filter((r) => !r.summary || !r.access).map((r) => r.name);

    expect(silent).toEqual(WITHOUT_SUMMARY);
  });
});

describe('every UI parity row that points at an op points at a catalogue row', () => {
  const sourcesOf = (family: Family) => new Set(rows.filter((r) => r.family === family).map((r) => r.source));
  const canvas = sourcesOf(Family.Canvas);
  const editor = sourcesOf(Family.Editor);
  const frame = sourcesOf(Family.Frame);

  const routes = Object.values(PARITY_TABLES).flatMap((entries) => Object.values(entries as Record<string, { route?: Route }>).flatMap((p) => (p.route ? [p.route] : [])));

  it('canvas, editor and motion routes resolve in the catalogue', () => {
    const missing = routes.flatMap((route) => {
      if ('canvas' in route) {
        return canvas.has(route.canvas) ? [] : [`canvas:${route.canvas}`];
      }
      if ('editor' in route) {
        return editor.has(route.editor) ? [] : [`editor:${route.editor}`];
      }
      if ('motion' in route) {
        return frame.has(route.motion) ? [] : [`motion:${route.motion}`];
      }
      return [];
    });

    expect(missing).toEqual([]);
  });
});
