import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

const calls: { method: string; path: string; body: unknown }[] = [];

const fake: Server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c as Buffer));
  req.on('end', () => {
    const path = req.url ?? '';
    const raw = Buffer.concat(chunks).toString();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (path.startsWith('/auth/v1/user')) {
      res.end(JSON.stringify({ id: 'user-1', email: 'test@feega.app', aud: 'authenticated', role: 'authenticated' }));
      return;
    }
    if (path.startsWith('/api/')) {
      calls.push({ method: req.method ?? '', path, body: raw ? JSON.parse(raw) : null });
      res.end(JSON.stringify({ outcome: 'written', node: { id: 'n-1' } }));
      return;
    }
    res.end('[]');
  });
});

await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
process.env.PUBLIC_SUPABASE_URL = origin;
process.env.PUBLIC_SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.PUBLIC_APP_URL = origin;
process.env.HOME = mkdtempSync(join(tmpdir(), 'feega-canvas-'));

const { handleMcpFetch } = await import('./http-app.ts');

afterAll(() => fake.close());

async function rpc(method: string, params: unknown) {
  const res = await handleMcpFetch(
    new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer token' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  return (await res.json()) as { result?: { structuredContent?: Record<string, unknown>; tools?: { name: string; description: string }[] } };
}

async function callTool(name: string, args: Record<string, unknown>) {
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'canvas', version: '0.0.1' } });
  return (await rpc('tools/call', { name, arguments: args })).result;
}

beforeEach(() => {
  calls.length = 0;
});

describe('canvas_tool: the chat canvas ops over MCP', () => {
  test('runs an op on a project through the org canvas endpoint', async () => {
    const result = await callTool('canvas_tool', { project_id: 'p-1', op: 'create_node', input: { canvasId: 'c-1', type: 'doc', x: 0, y: 0 } });

    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/api/v1/org/canvas',
      body: { project_id: 'p-1', op: 'create_node', input: { canvasId: 'c-1', type: 'doc', x: 0, y: 0 } },
    });
    expect(result?.structuredContent).toMatchObject({ outcome: 'written' });
  });

  test('passes the showcase surface through unchanged: create_node motion, resize_node, draw_frame with a still, describe', async () => {
    const asks = [
      { op: 'create_node', input: { canvasId: 'c-1', type: 'motion', x: 0, y: 0, data: { format: 'custom', kind: 'frame' } } },
      { op: 'resize_node', input: { nodeId: 'n-1', width: 400, height: 300 } },
      { op: 'draw_frame', input: { canvasId: 'c-1', x: 0, y: 0, w: 1080, format: 'A poster', still: 1 } },
      { op: 'draw_element', input: { canvasId: 'c-1', drawn: { tool: 'rectangle', box: { left: 0, top: 0, width: 10, height: 10 } } } },
      { op: 'export_selection', input: { frameIds: ['f-1'], rows: [{ format: 'png', by: 'scale', value: 1 }] } },
      { op: 'describe', input: { op: 'draw_frame' } },
    ];

    for (const ask of asks) {
      calls.length = 0;
      await callTool('canvas_tool', { project_id: 'p-1', ...ask });
      expect(calls[0]).toEqual({ method: 'POST', path: '/api/v1/org/canvas', body: { project_id: 'p-1', ...ask } });
    }
  });

  test('teaches describe and the poster still in its description', async () => {
    await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'canvas', version: '0.0.1' } });
    const tools = (await rpc('tools/list', {})).result?.tools ?? [];
    const description = tools.find((t) => t.name === 'canvas_tool')?.description ?? '';

    expect(description).toContain('describe');
    expect(description).toContain('still?');
  });

  test('names every op it reaches in its description', async () => {
    await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'canvas', version: '0.0.1' } });
    const tools = (await rpc('tools/list', {})).result?.tools ?? [];
    const description = tools.find((t) => t.name === 'canvas_tool')?.description ?? '';

    for (const op of ['list_canvases', 'list_nodes', 'create_node', 'update_node', 'move_node', 'connect_nodes', 'delete_node', 'run_node', 'list_runs', 'list_models', 'preview_run_graph', 'run_graph']) {
      expect(description).toContain(op);
    }
  });
});
