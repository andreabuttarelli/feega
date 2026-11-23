import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { SettingKey, StylingChoice } from '../settings';
import { nodePlatform } from './node-platform';
import { Stored, type Platform } from './platform';

type Wire = { sent: ViewMessage[]; fromView: (message: HostMessage) => void };

const memory = vi.hoisted(() => ({ config: new Map<string, unknown>(), state: new Map<string, unknown>(), handlers: [] as ((m: unknown) => void)[], sent: [] as unknown[] }));

vi.mock('vscode', () => ({
  ViewColumn: { One: 1, Beside: -2 },
  ConfigurationTarget: { Global: 1 },
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) => (memory.config.has(key) ? memory.config.get(key) : fallback),
      update: async (key: string, value: unknown) => void memory.config.set(key, value)
    })
  },
  window: {},
  commands: {},
  env: {},
  Uri: {}
}));

const { vsCodePlatform } = await import('./vscode-platform');

function vsCode(): [Platform, Wire] {
  const context = { extension: { packageJSON: { version: '1.2.3' } }, workspaceState: { get: (k: string) => memory.state.get(k), update: async (k: string, v: unknown) => void memory.state.set(k, v) } };
  const panel = {
    viewColumn: 1,
    webview: { postMessage: async (m: unknown) => (memory.sent.push(m), true), onDidReceiveMessage: (h: (m: unknown) => void) => (memory.handlers.push(h), { dispose: () => undefined }) }
  };
  memory.config.clear();
  memory.state.clear();
  memory.sent.length = 0;
  memory.handlers.length = 0;
  const platform = vsCodePlatform({ context, output: { append: () => undefined, show: () => undefined }, launcher: '/l' } as never, panel as never, new Map());
  return [platform, { sent: memory.sent as ViewMessage[], fromView: (m) => memory.handlers.forEach((h) => h(m)) }];
}

function node(): [Platform, Wire] {
  const root = mkdtempSync(join(tmpdir(), 'feega-platform-'));
  const sent: ViewMessage[] = [];
  const handlers: ((m: HostMessage) => unknown)[] = [];
  const transport = { send: (m: ViewMessage) => sent.push(m), receive: (h: (m: HostMessage) => unknown) => void handlers.push(h) };
  const platform = nodePlatform({ root, launcher: '/l', version: '1.2.3', transport, print: () => undefined, launch: async () => false });
  return [platform, { sent, fromView: (m) => handlers.forEach((h) => h(m)) }];
}

const ADAPTERS: [string, () => [Platform, Wire]][] = [
  ['vscode', vsCode],
  ['node', node]
];

describe.each(ADAPTERS)('the %s host platform', (_name, make) => {
  it('delivers host messages to the view and view messages to the host', () => {
    const [platform, wire] = make();
    const got: HostMessage[] = [];
    platform.receive((m) => got.push(m));

    platform.send({ kind: ToView.Status, text: 'hi' });
    wire.fromView({ kind: ToHost.Ready });

    expect(wire.sent).toEqual([{ kind: ToView.Status, text: 'hi' }]);
    expect(got).toEqual([{ kind: ToHost.Ready }]);
  });

  it('starts from the default settings and keeps a changed one', async () => {
    const [platform] = make();

    expect(platform.settings()[SettingKey.Styling]).toBe(StylingChoice.Auto);
    await platform.setSetting(SettingKey.Styling, StylingChoice.Css);

    expect(platform.settings()[SettingKey.Styling]).toBe(StylingChoice.Css);
    expect(platform.settings()[SettingKey.DevCommand]).toBe('');
  });

  it('keeps what the session stores', async () => {
    const [platform] = make();

    expect(platform.stored(Stored.Prefs)).toBeUndefined();
    await platform.store(Stored.Prefs, { size: 'phone' });

    expect(platform.stored(Stored.Prefs)).toEqual({ size: 'phone' });
  });

  it('names its version', () => {
    expect(make()[0].version).toBe('1.2.3');
  });
});

describe('the node platform on disk', () => {
  it('keeps settings in .feega/settings.json, read again on the next start', async () => {
    const root = mkdtempSync(join(tmpdir(), 'feega-settings-'));
    const make = () => nodePlatform({ root, launcher: '', version: '', transport: { send: () => undefined, receive: () => undefined }, print: () => undefined, launch: async () => false });

    await make().setSetting(SettingKey.DevCommand, 'pnpm dev');

    expect(JSON.parse(readFileSync(join(root, '.feega/settings.json'), 'utf8'))).toEqual({ [SettingKey.DevCommand]: 'pnpm dev' });
    expect(make().settings()[SettingKey.DevCommand]).toBe('pnpm dev');
  });

  it('keeps state outside the project tree', async () => {
    const root = mkdtempSync(join(tmpdir(), 'feega-state-'));
    const cache = mkdtempSync(join(tmpdir(), 'feega-cache-'));
    const make = () => nodePlatform({ root, launcher: '', version: '', transport: { send: () => undefined, receive: () => undefined }, print: () => undefined, launch: async () => false, env: { XDG_CACHE_HOME: cache } });

    await make().store(Stored.App, 'web');

    expect(existsSync(join(root, '.feega/state.json'))).toBe(false);
    expect(make().stored(Stored.App)).toBe('web');
  });

  it('forgets the edit history when the editor restarts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'feega-history-'));
    const cache = mkdtempSync(join(tmpdir(), 'feega-cache-'));
    const make = () => nodePlatform({ root, launcher: '', version: '', transport: { send: () => undefined, receive: () => undefined }, print: () => undefined, launch: async () => false, env: { XDG_CACHE_HOME: cache } });
    const running = make();

    await running.store(Stored.History, { steps: [1], undone: [] });

    expect(running.stored(Stored.History)).toEqual({ steps: [1], undone: [] });
    expect(make().stored(Stored.History)).toBeUndefined();
  });

  it('starts with the full preview width but keeps the panel widths', async () => {
    const root = mkdtempSync(join(tmpdir(), 'feega-prefs-'));
    const cache = mkdtempSync(join(tmpdir(), 'feega-cache-'));
    const make = () => nodePlatform({ root, launcher: '', version: '', transport: { send: () => undefined, receive: () => undefined }, print: () => undefined, launch: async () => false, env: { XDG_CACHE_HOME: cache } });

    await make().store(Stored.Prefs, { size: 'phone', custom: 700, barClosed: false, barWidth: 320 });

    expect(make().stored(Stored.Prefs)).toEqual({ size: 'full', custom: null, barClosed: false, barWidth: 320 });
  });

  it('opens a source in VS Code at its line, else prints where it is', async () => {
    const launched: string[][] = [];
    const printed: string[] = [];
    const platform = (codeOk: boolean) =>
      nodePlatform({ root: '/app', launcher: '', version: '', env: {}, transport: { send: () => undefined, receive: () => undefined }, print: (l) => printed.push(l), launch: async (c, a) => (launched.push([c, ...a]), codeOk) });

    await platform(true).openSource('/app', { file: 'src/App.svelte', line: 4, col: 2 });
    await platform(false).openSource('/app', { file: 'src/App.svelte', line: 4, col: 2 });

    expect(launched[0]).toEqual(['code', '-g', `${join('/app', 'src/App.svelte')}:4:2`]);
    expect(printed).toEqual([`${join('/app', 'src/App.svelte')}:4:2`]);
  });
});
