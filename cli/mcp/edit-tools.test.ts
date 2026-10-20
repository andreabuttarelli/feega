import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

const calls: { method: string; path: string; body: unknown }[] = [];
const answer = { status: 200, body: {} as unknown };

const fake: Server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c as Buffer));
  req.on('end', () => {
    const path = req.url ?? '';
    const raw = Buffer.concat(chunks).toString();
    if (path.startsWith('/auth/v1/user')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'user-1', email: 'test@feega.app', aud: 'authenticated', role: 'authenticated' }));
      return;
    }
    if (path.startsWith('/api/')) {
      calls.push({ method: req.method ?? '', path, body: raw ? JSON.parse(raw) : null });
      res.writeHead(answer.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(answer.body));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('[]');
  });
});

await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
process.env.PUBLIC_SUPABASE_URL = origin;
process.env.PUBLIC_SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.PUBLIC_APP_URL = origin;
process.env.HOME = mkdtempSync(join(tmpdir(), 'feega-edit-'));

const { handleMcpFetch } = await import('./http-app.ts');

afterAll(() => fake.close());

type Result = { isError?: boolean; content?: { type: string; text?: string; data?: string }[]; structuredContent?: Record<string, unknown> };

async function rpc(method: string, params: unknown) {
  const res = await handleMcpFetch(
    new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer token' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  return (await res.json()) as { result?: Result & { tools?: { name: string; description: string }[] } };
}

async function callTool(name: string, args: Record<string, unknown>) {
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'edit', version: '0.0.1' } });
  return (await rpc('tools/call', { name, arguments: args })).result;
}

beforeEach(() => {
  calls.length = 0;
  answer.status = 200;
  answer.body = { ok: true };
});

describe('edit: one tool for the canvas and the frames', () => {
  test('sends one op to the one edit endpoint, whatever registry owns it', async () => {
    await callTool('edit', { op: 'add_shape', target: 'f-1', input: { kind: 'rect', start: 0 }, version: 3 });
    await callTool('edit', { op: 'move_node', target: 'n-1', project_id: 'p-1', input: { x: 1, y: 2 } });

    expect(calls.map((c) => c.path)).toEqual(['/api/v1/edit', '/api/v1/edit']);
    expect(calls[0].body).toEqual({ op: 'add_shape', target: 'f-1', input: { kind: 'rect', start: 0 }, version: 3 });
    expect(calls[1].body).toEqual({ op: 'move_node', target: 'n-1', project_id: 'p-1', input: { x: 1, y: 2 } });
  });

  test('a batch carries its ops', async () => {
    await callTool('edit', { op: 'batch', project_id: 'p-1', ops: [{ op: 'add_shape', target: 'f-1' }, { op: 'delete_node', target: 'n-1' }] });

    expect(calls[0].body).toEqual({ op: 'batch', project_id: 'p-1', ops: [{ op: 'add_shape', target: 'f-1' }, { op: 'delete_node', target: 'n-1' }] });
  });

  test('a refused batch keeps the whole answer, applied and failed included', async () => {
    answer.status = 404;
    answer.body = { applied: 1, failed: 1, error: { error: 'node_not_found' }, results: [] };

    const result = await callTool('edit', { op: 'batch', ops: [{ op: 'x' }, { op: 'y' }] });

    expect(result?.isError).toBe(true);
    expect(result?.content?.[0].text).toContain('"applied": 1');
    expect(result?.content?.[0].text).toContain('"failed": 1');
  });

  test('teaches describe, batch and the collision names in its description', async () => {
    await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'edit', version: '0.0.1' } });
    const tools = (await rpc('tools/list', {})).result?.tools ?? [];
    const description = tools.find((t) => t.name === 'edit')?.description ?? '';

    for (const word of ['describe', 'batch', 'target', 'element', 'frame_', 'editor_', 'all or none']) {
      expect(description).toContain(word);
    }
  });

  test('the three older tools say they are deprecated aliases', async () => {
    await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'edit', version: '0.0.1' } });
    const tools = (await rpc('tools/list', {})).result?.tools ?? [];

    for (const name of ['canvas_tool', 'motion_tool', 'motion_editor_op']) {
      expect(tools.find((t) => t.name === name)?.description).toMatch(/^Deprecated, use `edit`/);
    }
  });
});

describe('view: the agent sees the canvas', () => {
  test('reads through the view endpoint', async () => {
    await callTool('view', { op: 'canvas_summary', input: { canvas_id: 'c-1' } });

    expect(calls[0]).toEqual({ method: 'POST', path: '/api/v1/view', body: { op: 'canvas_summary', input: { canvas_id: 'c-1' } } });
  });

  test('a snapshot comes back as an image the model sees', async () => {
    answer.body = { revision: 2, frames: [{ time: 0, mime: 'image/jpeg', data: 'AAAA' }], quality: [], blocking: [] };

    const result = await callTool('view', { op: 'snapshot', input: { node_id: 'f-1' } });

    expect(result?.content?.map((c) => c.type)).toEqual(['text', 'image']);
    expect(result?.content?.[1].data).toBe('AAAA');
  });

  test('a closed renderer is an error with its reason', async () => {
    answer.status = 503;
    answer.body = { error: 'server_frames_unavailable', detail: 'closed' };

    const result = await callTool('view', { op: 'snapshot', input: { node_id: 'f-1' } });

    expect(result?.isError).toBe(true);
    expect(result?.content?.[0].text).toContain('server_frames_unavailable');
  });
});
