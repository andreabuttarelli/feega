import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
    if (route === '/api/v1/motion') {
      send(200, { videos: [{ node_id: NODE, name: 'Launch', version: 3 }] });
      return;
    }
    if (route === `/api/v1/motion/${NODE}/embed/bundle`) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>bundle</html>');
      return;
    }
    if (route === `/api/v1/motion/${NODE}/embed`) {
      const published = req.method !== 'DELETE';
      send(200, published ? { published, url: `https://feega.app/e/${NODE}`, snippet: `<iframe src="https://feega.app/e/${NODE}"></iframe>`, react: `<FeegaMotion id="${NODE}" />`, flutter: `FeegaMotion(id: '${NODE}')`, revision: 3 } : { published });
      return;
    }
    if (route === `/api/v1/motion/${NODE}/revisions`) {
      send(200, req.method === 'POST' ? { version: 21, restored: 17 } : { revisions: [{ version: 20, summary: 'Undo', actorKind: 'user', createdAt: '', clips: 0 }] });
      return;
    }
    if (route === `/api/v1/motion/${NODE}/storyboard`) {
      send(200, req.method === 'GET' ? { canvas_id: 'board', cards: [{ node_id: 'c1', text: '## Hook', clip_ids: [] }], media: [], flow: [] } : { ok: true, canvas_id: 'board' });
      return;
    }
    if (route === `/api/v1/motion/${NODE}/frames`) {
      send(200, { revision: 3, frames: [{ time: 1, mime: 'image/jpeg', data: 'AAAA' }], quality: ['title too small'], blocking: [] });
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
  test('ask_motion_agent with wait true polls until the revision', async () => {
    const result = await callTool('ask_motion_agent', { node_id: NODE, prompt: 'make the title red', wait: true });

    expect(calls[0]).toEqual({ method: 'POST', path: `/api/v1/motion/${NODE}/ask`, body: { prompt: 'make the title red' } });
    expect(result?.structuredContent).toMatchObject({ run_id: RUN, status: 'done', version: 3, summary: 'added Title' });
  });

  test('ask_motion_agent passes attachments through: URLs, asset ids, inline files', async () => {
    const attachments = [{ url: 'https://example.com/brief.pdf' }, { asset_id: 'a-1' }, { data: 'aGk=', name: 'notes.md', mime_type: 'text/markdown' }];
    await callTool('ask_motion_agent', { node_id: NODE, prompt: 'use these', attachments });

    expect(calls[0]).toEqual({ method: 'POST', path: `/api/v1/motion/${NODE}/ask`, body: { prompt: 'use these', attachments } });
  });

  test('ask_motion_agent returns the run at once by default', async () => {
    const result = await callTool('ask_motion_agent', { node_id: NODE, prompt: 'add a bounce' });

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

    calls.length = 0;
    await callTool('render_video', { node_id: NODE, mode: 'server', format: 'mp4-h265', quality: 'standard', fps: 60 });
    expect(calls[0].body).toEqual({ mode: 'server', settings: { format: 'mp4-h265', quality: 'standard', fps: 60 } });
  });

  test('list_motion_videos lists the videos, narrowed to a project', async () => {
    const result = await callTool('list_motion_videos', { project_id: 'p-1' });
    expect(calls[0]).toEqual({ method: 'GET', path: '/api/v1/motion?project=p-1', body: null });
    expect(JSON.stringify(result)).toContain('Launch');
  });

  test('publish_motion_embed publishes and returns the snippet', async () => {
    const result = await callTool('publish_motion_embed', { node_id: NODE });
    expect(calls[0]).toMatchObject({ method: 'POST', path: `/api/v1/motion/${NODE}/embed` });
    expect(result?.structuredContent).toMatchObject({ published: true, url: `https://feega.app/e/${NODE}` });
    expect(JSON.stringify(result)).toContain('iframe');
    expect(result?.structuredContent).toMatchObject({ react: `<FeegaMotion id="${NODE}" />`, flutter: `FeegaMotion(id: '${NODE}')` });
  });

  test('publish_motion_embed with unpublish takes it down', async () => {
    const result = await callTool('publish_motion_embed', { node_id: NODE, action: 'unpublish' });
    expect(calls[0]).toMatchObject({ method: 'DELETE', path: `/api/v1/motion/${NODE}/embed` });
    expect(result?.structuredContent).toMatchObject({ published: false });
  });

  test('get_motion_embed reads the embed state', async () => {
    await callTool('get_motion_embed', { node_id: NODE });
    expect(calls[0]).toMatchObject({ method: 'GET', path: `/api/v1/motion/${NODE}/embed` });
  });

  test('view_motion_frames returns each frame as an image and the quality notes as text', async () => {
    const result = (await callTool('view_motion_frames', { node_id: NODE, times: [1], width: 480 })) as { content: { type: string; data?: string; mimeType?: string; text?: string }[] };
    expect(calls[0]).toEqual({ method: 'POST', path: `/api/v1/motion/${NODE}/frames`, body: { times: [1], width: 480 } });
    expect(result.content.find((c) => c.type === 'image')).toEqual({ type: 'image', data: 'AAAA', mimeType: 'image/jpeg' });
    const text = result.content.find((c) => c.type === 'text')?.text ?? '';
    expect(text).toContain('title too small');
    expect(text).not.toContain('AAAA');
  });

  test('restore_motion_revision posts the version and keeps history server side', async () => {
    const result = await callTool('restore_motion_revision', { node_id: NODE, version: 17 });
    expect(calls[0]).toEqual({ method: 'POST', path: `/api/v1/motion/${NODE}/revisions`, body: { version: 17 } });
    expect(JSON.stringify(result)).toContain('21');
  });

  test('list_motion_revisions reads the versions with their clip counts', async () => {
    const result = await callTool('list_motion_revisions', { node_id: NODE });
    expect(calls[0]).toMatchObject({ method: 'GET', path: `/api/v1/motion/${NODE}/revisions` });
    expect(JSON.stringify(result)).toContain('clips');
  });

  test('get_render reads a render and its file', async () => {
    const result = await callTool('get_render', { run_id: 'render-1' });
    expect(calls[0].path).toBe('/api/v1/motion/renders/render-1');
    expect(JSON.stringify(result)).toContain('https://files/a1.mp4');
  });

  test('only the motion tools are exposed, not the editor ones', async () => {
    await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'motion', version: '0.0.1' } });
    const names = ((await rpc('tools/list', {})).result?.tools ?? []).map((t) => t.name);

    expect(names.filter((n) => n.includes('motion')).sort()).toEqual(['ask_motion_agent', 'get_motion_embed', 'get_motion_run', 'get_motion_summary', 'list_motion_revisions', 'list_motion_videos', 'publish_motion_embed', 'restore_motion_revision', 'view_motion_frames']);
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

describe('feega motion ask --attach', () => {
  test('a local file goes inline, a URL as a URL, asset:<id> as an asset', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'feega-attach-'));
    const file = join(dir, 'notes.md');
    writeFileSync(file, '# Notes');
    const log = console.log;
    console.log = () => {};
    const { askAndReport } = await import('../commands/motion.ts');

    await askAndReport('token', NODE, 'summarize', { wait: false, attach: [file, 'https://example.com/logo.png', 'asset:a-9'] }).finally(() => {
      console.log = log;
    });

    expect(calls[0].body).toEqual({
      prompt: 'summarize',
      attachments: [{ data: Buffer.from('# Notes').toString('base64'), name: 'notes.md', mime_type: 'text/markdown' }, { url: 'https://example.com/logo.png' }, { asset_id: 'a-9' }]
    });
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

describe('feega motion embed', () => {
  test('publishes and prints the snippet', async () => {
    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.join(' '));
    };
    const { embedAndReport } = await import('../commands/motion.ts');
    await embedAndReport('token', NODE, {}).finally(() => {
      console.log = log;
    });

    expect(calls[0]).toMatchObject({ method: 'POST', path: `/api/v1/motion/${NODE}/embed` });
    expect(lines.join('\n')).toContain('<iframe');
    expect(lines.join('\n')).toContain(`React:\n<FeegaMotion id="${NODE}" />`);
    expect(lines.join('\n')).toContain(`Flutter:\nFeegaMotion(id: '${NODE}')`);
  });

  test('--download saves the self-contained html', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'feega-bundle-'));
    const { embedAndReport } = await import('../commands/motion.ts');
    const log = console.log;
    console.log = () => {};
    await embedAndReport('token', NODE, { download: join(dir, 'out.html') }).finally(() => {
      console.log = log;
    });

    expect(calls[0]).toMatchObject({ method: 'GET', path: `/api/v1/motion/${NODE}/embed/bundle` });
    expect(readFileSync(join(dir, 'out.html'), 'utf8')).toBe('<html>bundle</html>');
  });
});

describe('feega motion frames', () => {
  test('saves each frame as a jpeg and prints the quality notes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'feega-frames-'));
    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.join(' '));
    };
    const { framesAndReport } = await import('../commands/motion.ts');
    await framesAndReport('token', NODE, { at: '1', out: dir }).finally(() => {
      console.log = log;
    });

    expect(calls[0]).toEqual({ method: 'POST', path: `/api/v1/motion/${NODE}/frames`, body: { times: [1] } });
    expect(readFileSync(join(dir, `${NODE}-1s.jpg`))).toEqual(Buffer.from('AAAA', 'base64'));
    expect(lines.join('\n')).toContain('title too small');
  });
});

describe('the storyboard over MCP', () => {
  test('get_storyboard reads the cards', async () => {
    const result = await callTool('get_storyboard', { node_id: NODE });

    expect(calls[0]).toMatchObject({ method: 'GET', path: `/api/v1/motion/${NODE}/storyboard` });
    expect(result?.structuredContent).toMatchObject({ canvas_id: 'board', cards: [{ node_id: 'c1' }] });
  });

  test('write_storyboard posts the beats, edit_storyboard_card patches one card', async () => {
    const beats = [{ act: 'problem', kind: 'scene', title: 'Hook', intent: 'the pain', emotion: 'tense', intensity: 0.4, duration: 3 }];
    await callTool('write_storyboard', { node_id: NODE, beats });
    await callTool('edit_storyboard_card', { node_id: NODE, card_id: 'c1', text: '## New' });

    expect(calls[0]).toEqual({ method: 'POST', path: `/api/v1/motion/${NODE}/storyboard`, body: { beats } });
    expect(calls[1]).toEqual({ method: 'PATCH', path: `/api/v1/motion/${NODE}/storyboard`, body: { card_id: 'c1', text: '## New' } });
  });
});
