import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Origin } from '@feega/plugin-api/external';
import { readRegistry } from '@feega/plugin-store/registry';
import { tarball } from '@feega/plugin-store/tar-fixture';
import { ToView, type ViewMessage } from '../messages';
import { pluginsSession } from './plugins-session';

const MANIFEST = JSON.stringify({ id: 'acme.hello', name: 'Hello', version: '1.0.0', permissions: ['selection'] });

let root: string;
let sent: ViewMessage[];
let told: string[];
let asked: string[];

const setup = (over: { terminal?: boolean; answer?: boolean; dev?: string[]; fetch?: (url: string) => Promise<Uint8Array> } = {}) => {
  const session = pluginsSession({
    host: { root, dev: () => over.dev ?? [], approve: over.terminal ? undefined : async (question) => (asked.push(question), over.answer ?? true) },
    post: (message) => void sent.push(message),
    notify: (text) => void told.push(text),
    fetch: over.fetch ?? (async () => tarball({ 'feega-plugin.json': MANIFEST, 'plugin.js': 'x' })),
    watch: () => () => undefined
  });
  return session;
};

const lastCatalog = () => (sent.filter((m) => m.kind === ToView.Plugins).at(-1) as Extract<ViewMessage, { kind: ToView.Plugins }>).catalog;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'feega-session-'));
  sent = [];
  told = [];
  asked = [];
});

describe('pluginsSession', () => {
  it('shows the catalog with installed and dev plugins', async () => {
    const dev = mkdtempSync(join(tmpdir(), 'feega-dev-'));
    mkdirSync(dev, { recursive: true });
    writeFileSync(join(dev, 'feega-plugin.json'), JSON.stringify({ id: 'me.dev', name: 'Dev', version: '0.0.1' }));
    writeFileSync(join(dev, 'plugin.js'), 'y');
    await setup({ dev: [dev] }).show();
    expect(lastCatalog().plugins).toMatchObject([{ id: 'me.dev', origin: Origin.Dev }]);
  });

  it('tells the host a plugin was installed, and only then', async () => {
    const installed: string[] = [];
    const base = { post: () => undefined, notify: () => undefined, watch: () => () => undefined };
    const session = pluginsSession({ ...base, host: { root, dev: () => [], approve: async () => true }, fetch: async () => tarball({ 'feega-plugin.json': MANIFEST, 'plugin.js': 'x' }), onInstalled: () => void installed.push('yes') });
    await session.install('github:acme/hello@v1.0.0');
    const declined = pluginsSession({ ...base, host: { root, dev: () => [], approve: async () => false }, onInstalled: () => void installed.push('no') });
    await declined.install('github:acme/other@v1.0.0');

    expect(installed).toEqual(['yes']);
  });

  it('installs after the user approves, then shows the new plugin', async () => {
    const session = setup();
    await session.install('github:acme/hello@v1.0.0');
    expect(asked[0]).toContain('See which element you select');
    expect(lastCatalog().plugins).toMatchObject([{ id: 'acme.hello', origin: Origin.Installed, enabled: true }]);
    expect(told).toEqual(['Installed acme.hello 1.0.0']);
  });

  it('installs nothing when the user declines', async () => {
    const session = setup({ answer: false });
    await session.install('github:acme/hello@v1.0.0');
    expect(readRegistry(root).installed).toEqual({});
    expect(told).toEqual(['not approved']);
  });

  it('sends the user to the terminal where it cannot ask', async () => {
    const session = setup({ terminal: true });
    await session.install('github:acme/hello@v1.0.0');
    expect(told).toEqual(['Install it from the terminal: npx feega plugin add github:acme/hello@v1.0.0']);
    expect(readRegistry(root).installed).toEqual({});
  });

  it('switches a plugin off and on, built-ins included', async () => {
    const session = setup();
    await session.enable('feega.mesh-gradient', false);
    expect(lastCatalog().disabled).toEqual(['feega.mesh-gradient']);
    await session.enable('feega.mesh-gradient', true);
    expect(lastCatalog().disabled).toEqual([]);
  });

  it('removes an installed plugin', async () => {
    const session = setup();
    await session.install('github:acme/hello@v1.0.0');
    await session.remove('acme.hello');
    expect(lastCatalog().plugins).toEqual([]);
  });

  it('tells the user when a removal fails', async () => {
    await setup().remove('nope');
    expect(told).toEqual(['nope is not installed']);
  });

  it('shows the catalog again when the watched files change', async () => {
    vi.useFakeTimers();
    let changed = () => undefined as void;
    const session = pluginsSession({ host: { root, dev: () => [] }, post: (m) => void sent.push(m), notify: () => undefined, fetch: async () => new Uint8Array(), watch: (_dir, onChange) => ((changed = onChange), () => undefined) });
    await session.show();
    const before = sent.length;
    changed();
    await vi.advanceTimersByTimeAsync(500);
    expect(sent.length).toBeGreaterThan(before);
    session.stop();
    vi.useRealTimers();
  });
});
