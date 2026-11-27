import { basename } from 'node:path';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerState, ToView, type HostMessage, type ViewMessage } from '../messages';
import { nodePlatform } from './node-platform';
import type { Platform } from './platform';
import { inspectSession } from './session';
import { NO_ATTACH_MESSAGE } from '@feega/dev-run/attach-rule';

const memory = vi.hoisted(() => ({ state: new Map<string, unknown>(), handlers: [] as ((m: unknown) => void)[], sent: [] as unknown[] }));

vi.mock('vscode', () => ({
  ViewColumn: { One: 1, Beside: -2 },
  ConfigurationTarget: { Global: 1 },
  workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback, update: async () => undefined }) },
  window: {},
  commands: {},
  env: {},
  Uri: {}
}));

const { vsCodePlatform } = await import('./vscode-platform');

type Made = { platform: Platform; sent: ViewMessage[] };

const launcher = () => {
  const dir = mkdtempSync(join(tmpdir(), 'launcher-'));
  writeFileSync(join(dir, 'bridge.js'), 'export {};');
  return dir;
};

function vsCode(): Made {
  memory.state.clear();
  memory.sent.length = 0;
  const context = { globalStorageUri: { fsPath: '/storage' }, extension: { packageJSON: { version: '1' } }, workspaceState: { get: (k: string) => memory.state.get(k), update: async (k: string, v: unknown) => void memory.state.set(k, v) } };
  const panel = { viewColumn: 1, webview: { postMessage: async (m: unknown) => (memory.sent.push(m), true), onDidReceiveMessage: () => ({ dispose: () => undefined }) } };
  const platform = vsCodePlatform({ context, output: { append: () => undefined, show: () => undefined }, launcher: launcher() } as never, panel as never, new Map());
  return { platform, sent: memory.sent as ViewMessage[] };
}

function node(): Made {
  const sent: ViewMessage[] = [];
  const transport = { send: (m: ViewMessage) => sent.push(m), receive: (_h: (m: HostMessage) => unknown) => undefined };
  const platform = nodePlatform({ root: mkdtempSync(join(tmpdir(), 'feega-state-')), launcher: launcher(), version: '1', transport, print: () => undefined, launch: async () => false });
  return { platform, sent };
}

const ADAPTERS: [string, () => Made][] = [
  ['vscode', vsCode],
  ['node', node]
];

const servers: Server[] = [];

async function appServer(html: string): Promise<string> {
  const server = createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/html' }).end(html));
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

function workspaceOf(...apps: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'feega-ws-'));
  for (const app of apps.length ? apps : ['']) {
    mkdirSync(join(root, app), { recursive: true });
    writeFileSync(join(root, app, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' }, devDependencies: { vite: '^5.0.0' } }));
  }
  return root;
}

function workspaceWith(devDependencies: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'feega-ws-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { dev: 'dev' }, devDependencies }));
  return root;
}

afterEach(() => servers.splice(0).forEach((s) => s.close()));

describe.each(ADAPTERS)('attaching to a URL on the %s platform', (_name, make) => {
  it('shows the app through the proxy and leaves the server running on stop', async () => {
    const { platform, sent } = make();
    const target = await appServer('<html><head></head><body>hi</body></html>');
    const session = inspectSession(platform, workspaceOf());

    const out = await session.attachUrl(target);
    const shown = sent.find((m) => m.kind === ToView.App);
    session.stop();

    expect(out).not.toHaveProperty('refused');
    expect(shown && 'url' in shown && shown.url).not.toBe(target);
    expect(sent).toContainEqual(expect.objectContaining({ kind: ToView.Server, state: ServerState.Running, info: expect.objectContaining({ attached: true, pid: null }) }));
    expect((await fetch(target)).status).toBe(200);
  });

  it('names the project after its folder for the view tabs', async () => {
    const { platform, sent } = make();
    const target = await appServer('<html><head></head><body>hi</body></html>');
    const workspace = workspaceOf();
    const session = inspectSession(platform, workspace);

    await session.attachUrl(target);
    session.stop();

    const app = sent.find((m) => m.kind === ToView.App);
    expect(app && 'project' in app && app.project).toBe(basename(workspace));
  });

  it('tells the preview to load the url before it reports the server running', async () => {
    const { platform, sent } = make();
    const target = await appServer('<html><head></head><body>hi</body></html>');
    const session = inspectSession(platform, workspaceOf());

    await session.attachUrl(target);
    session.stop();

    const kinds = sent.map((m) => (m.kind === ToView.Server ? m.state : m.kind));
    const app = sent.find((m) => m.kind === ToView.App);
    const running = sent.find((m) => m.kind === ToView.Server && m.state === ServerState.Running);
    expect(kinds.indexOf(ToView.App)).toBeGreaterThan(kinds.indexOf(ServerState.Starting));
    expect(kinds.indexOf(ToView.App)).toBeLessThan(kinds.indexOf(ServerState.Running));
    expect(app && 'url' in app && app.url).toBe(running && 'info' in running && running.info?.url);
    expect(app && 'url' in app && new URL(app.url).port).toBe(String(running && 'info' in running && running.info?.port));
  });

  it.each([['astro'], ['nuxt']])('refuses to attach to a %s dev server and offers to start it', async (dependency) => {
    const { platform, sent } = make();
    const target = await appServer('<html><head></head><body>hi</body></html>');
    const warn = vi.fn(async () => false);
    const session = inspectSession({ ...platform, warn }, workspaceWith({ [dependency]: '^5.0.0' }));

    const out = await session.attachUrl(target);

    expect(out).toEqual({ refused: NO_ATTACH_MESSAGE, attachRefused: true });
    expect(warn).toHaveBeenCalledWith(NO_ATTACH_MESSAGE, 'Start with Feega');
    expect(sent).toContainEqual(expect.objectContaining({ kind: ToView.Server, state: ServerState.Stopped, reason: NO_ATTACH_MESSAGE }));
    expect(sent.some((m) => m.kind === ToView.App)).toBe(false);
  });

  it('refuses an address nothing answers on', async () => {
    const { platform, sent } = make();
    const session = inspectSession(platform, workspaceOf());

    const out = await session.attachUrl('http://127.0.0.1:1');

    expect(out).toEqual({ refused: expect.stringContaining('127.0.0.1:1') });
    expect(sent).toContainEqual(expect.objectContaining({ kind: ToView.Server, state: ServerState.Stopped }));
  });

  it('infers the app from the first stamped source on the page', async () => {
    const { platform } = make();
    const target = await appServer('<body><div data-feega-src="apps/admin/src/a.tsx:1:1"></div></body>');
    const ask = vi.fn(async () => null);
    const session = inspectSession({ ...platform, chooseApp: ask }, workspaceOf('apps/web', 'apps/admin'));

    await session.attachUrl(target);

    expect(ask).not.toHaveBeenCalled();
    expect(session.root().endsWith(join('apps', 'admin'))).toBe(true);
  });

  it('asks which app when the page says nothing and there are several', async () => {
    const { platform } = make();
    const target = await appServer('<body></body>');
    const ask = vi.fn(async (apps: string[]) => apps[0]);
    const session = inspectSession({ ...platform, chooseApp: ask }, workspaceOf('apps/web', 'apps/admin'));

    await session.attachUrl(target);

    expect(ask).toHaveBeenCalledWith(['apps/admin', 'apps/web'], expect.any(String));
    expect(session.root().endsWith(join('apps', 'admin'))).toBe(true);
  });

  it('adds the Feega plugin to the vite config when asked', async () => {
    const { platform } = make();
    const workspace = workspaceOf();
    writeFileSync(join(workspace, 'vite.config.ts'), "import { defineConfig } from 'vite';\nexport default defineConfig({ plugins: [] });\n");
    const session = inspectSession(platform, workspace);

    await session.addPlugin();

    const written = (await import('node:fs')).readFileSync(join(workspace, 'vite.config.ts'), 'utf8');
    expect(written).toContain('feegaSource()');
  });
});
