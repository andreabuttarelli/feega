import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

const NODE = 'node-1';
const RUN = 'run-1';

const calls: { method: string; path: string; body: unknown }[] = [];
let polls = 0;

const fake: Server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c as Buffer));
  req.on('end', () => {
    const path = req.url ?? '';
    const raw = Buffer.concat(chunks).toString();
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (path.startsWith('/auth/v1/user')) {
      send(200, { id: 'user-1', email: 'test@feega.app', aud: 'authenticated', role: 'authenticated' });
      return;
    }
    if (!path.startsWith('/api/')) {
      send(200, []);
      return;
    }

    calls.push({ method: req.method ?? '', path, body: raw ? JSON.parse(raw) : null });
    const route = path.split('?')[0];
    if (route === `/api/v1/motion/${NODE}/ask`) {
      send(202, { run_id: RUN, status: 'running' });
      return;
    }
    if (route === `/api/v1/motion/runs/${RUN}`) {
      polls++;
      send(200, polls < 1 ? { run_id: RUN, status: 'running' } : { run_id: RUN, status: 'done', summary: 'added Title', version: 3, cost_usd: 0.01 });
      return;
    }
    if (route === `/api/v1/motion/${NODE}/render`) {
      const server = (raw ? JSON.parse(raw) : {}).mode === 'server';
      send(server ? 202 : 201, server ? { mode: 'server', run_id: 'farm-1', credits: 12 } : { mode: 'browser', run_id: 'render-1', render_url: `https://feega.app/render/render-1.s`, credits: 0 });
      return;
    }
    if (route === '/api/v1/motion/renders/render-1') {
      send(200, { run_id: 'render-1', mode: 'browser', status: 'done', asset_id: 'a1', file_url: 'https://files/a1.mp4' });
      return;
    }
    if (route === `/api/v1/motion/${NODE}`) {
      send(200, { node_id: NODE, version: 3, doc: { duration: 6, tracks: [] } });
      return;
    }
    send(404, { error: 'not_found' });
  });
});

await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
process.env.PUBLIC_SUPABASE_URL = origin;
process.env.PUBLIC_SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.PUBLIC_APP_URL = origin;
process.env.HOME = mkdtempSync(join(tmpdir(), 'feega-motion-'));

const { handleMcpFetch } = await import('./http-app.ts');

afterAll(() => fake.close());

const signedIn = { Authorization: 'Bearer token' };

async function rpc(method: string, params: unknown) {
  const res = await handleMcpFetch(
    new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...signedIn },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  return (await res.json()) as { result?: { structuredContent?: Record<string, unknown>; isError?: boolean; tools?: { name: string }[] } };
}

async function callTool(name: string, args: Record<string, unknown>) {
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'motion', version: '0.0.1' } });
  return (await rpc('tools/call', { name, arguments: args })).result;
}

beforeEach(() => {
  calls.length = 0;
  polls = 0;
});

describe('the motion agent over MCP', () => {
  test('ask_motion_agent sends the prompt and waits for the revision by default', async () => {
    const result = await callTool('ask_motion_agent', { node_id: NODE, prompt: 'make the title red' });

    expect(calls[0]).toEqual({ method: 'POST', path: `/api/v1/motion/${NODE}/ask`, body: { prompt: 'make the title red' } });
    expect(result?.structuredContent).toMatchObject({ run_id: RUN, status: 'done', version: 3, summary: 'added Title' });
  });

  test('ask_motion_agent with wait false returns the run at once', async () => {
    const result = await callTool('ask_motion_agent', { node_id: NODE, prompt: 'add a bounce', wait: false });

    expect(result?.structuredContent).toEqual({ run_id: RUN, status: 'running' });
    expect(calls).toHaveLength(1);
  });

  test('get_motion_run reads a run', async () => {
    polls = 5;
    const result = await callTool('get_motion_run', { run_id: RUN });

    expect(calls[0].path).toBe(`/api/v1/motion/runs/${RUN}`);
    expect(result?.structuredContent).toMatchObject({ status: 'done', version: 3 });
  });

  test('get_motion_summary reads the saved video', async () => {
    const result = await callTool('get_motion_summary', { node_id: NODE, org: 'org-9' });

    expect(calls[0].path).toBe(`/api/v1/motion/${NODE}?org=org-9`);
    expect(result?.structuredContent).toMatchObject({ node_id: NODE, version: 3 });
  });

  test('render_video returns a render link by default, a farm run only on request', async () => {
    const link = await callTool('render_video', { node_id: NODE });
    expect(calls[0]).toEqual({ method: 'POST', path: `/api/v1/motion/${NODE}/render`, body: { mode: 'browser' } });
    expect(JSON.stringify(link)).toContain('render-1.s');

    calls.length = 0;
    const farm = await callTool('render_video', { node_id: NODE, mode: 'server', resolution: '720p' });
    expect(calls[0].body).toEqual({ mode: 'server', settings: { resolution: '720p' } });
    expect(JSON.stringify(farm)).toContain('farm-1');
  });

  test('get_render reads a render and its file', async () => {
    const result = await callTool('get_render', { run_id: 'render-1' });
    expect(calls[0].path).toBe('/api/v1/motion/renders/render-1');
    expect(JSON.stringify(result)).toContain('https://files/a1.mp4');
  });

  test('only the motion tools are exposed, not the editor ones', async () => {
    await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'motion', version: '0.0.1' } });
    const names = ((await rpc('tools/list', {})).result?.tools ?? []).map((t) => t.name);

    expect(names.filter((n) => n.includes('motion')).sort()).toEqual(['ask_motion_agent', 'get_motion_run', 'get_motion_summary']);
    expect(names).toContain('render_video');
    expect(names).toContain('get_render');
    expect(names).not.toContain('add_clip');
  });
});

describe('feega motion ask', () => {
  test('waits for the run and prints the revision', async () => {
    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.join(' '));
    };
    const { askAndReport } = await import('../commands/motion.ts');

    await askAndReport('token', NODE, 'make the title red', {}).finally(() => {
      console.log = log;
    });

    expect(calls[0]).toEqual({ method: 'POST', path: `/api/v1/motion/${NODE}/ask`, body: { prompt: 'make the title red' } });
    expect(lines.join('\n')).toContain('revision 3');
    expect(lines.join('\n')).toContain('added Title');
  });
});

describe('feega motion render', () => {
  async function printed(work: () => Promise<void>): Promise<string> {
    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.join(' '));
    };
    await work().finally(() => {
      console.log = log;
    });
    return lines.join('\n');
  }

  test('prints the render link to open on a device', async () => {
    const { renderAndReport } = await import('../commands/motion.ts');
    const out = await printed(() => renderAndReport('token', NODE, {}));

    expect(calls[0]).toEqual({ method: 'POST', path: `/api/v1/motion/${NODE}/render`, body: { mode: 'browser' } });
    expect(out).toContain('https://feega.app/render/render-1.s');
  });

  test('--server asks the farm and says what it costs', async () => {
    const { renderAndReport } = await import('../commands/motion.ts');
    const out = await printed(() => renderAndReport('token', NODE, { server: true }));

    expect(calls[0].body).toEqual({ mode: 'server' });
    expect(out).toContain('12 credits');
  });
});
