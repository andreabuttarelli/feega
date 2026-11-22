import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { installPlugin, removePlugin, type Fetcher, type Review } from './install';
import { readRegistry, registryPath, setEnabled } from './registry';
import { tarball } from './tar-fixture';

const manifest = (over: object = {}) =>
  JSON.stringify({ id: 'acme.hello', name: 'Hello', version: '1.0.0', permissions: ['selection', 'edit.style', 'network:api.example.com'], contributions: { command: [{ id: 'go', title: 'Go' }] }, ...over });

const archive = (over: object = {}, files: Record<string, string> = {}) => tarball({ 'feega-plugin.json': manifest(over), 'plugin.js': 'self.ready = 1;', ...files });

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

type Served = Record<string, Uint8Array | string>;

const serving =
  (served: Served, asked: string[] = []): Fetcher =>
  async (url) => {
    asked.push(url);
    const found = served[url];
    if (found === undefined) {
      throw new Error(`404 ${url}`);
    }
    return typeof found === 'string' ? Buffer.from(found) : found;
  };

const GITHUB_TAG = 'https://codeload.github.com/acme/hello/tar.gz/refs/tags/v1.0.0';
const GITHUB_HEAD = 'https://codeload.github.com/acme/hello/tar.gz/HEAD';
const NPM_META = 'https://registry.npmjs.org/feega-plugin-hello/1.0.0';
const NPM_TARBALL = 'https://registry.npmjs.org/feega-plugin-hello/-/feega-plugin-hello-1.0.0.tgz';

let root: string;
let reviews: Review[];
const yes = async (review: Review) => (reviews.push(review), true);
const no = async (review: Review) => (reviews.push(review), false);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'feega-store-'));
  reviews = [];
});

describe('installPlugin from GitHub', () => {
  it('downloads the tag archive, shows the permissions in words, then installs and pins', async () => {
    const bytes = archive();
    const out = await installPlugin({ root, fetch: serving({ [GITHUB_TAG]: bytes }), approve: yes }, 'github:acme/hello@v1.0.0');

    expect(out).toEqual({ ok: true, id: 'acme.hello', version: '1.0.0' });
    expect(reviews[0].words).toEqual(['See which element you select', 'Change the styles of elements in your code', 'Send requests to api.example.com']);
    expect(readFileSync(join(root, 'acme.hello', '1.0.0', 'plugin.js'), 'utf8')).toBe('self.ready = 1;');
    expect(readRegistry(root).installed['acme.hello']).toEqual({ version: '1.0.0', source: 'github:acme/hello@v1.0.0', sha256: sha256(bytes), permissions: ['edit.style', 'network:api.example.com', 'selection'] });
  });

  it('takes the default branch when no tag is given', async () => {
    const asked: string[] = [];
    await installPlugin({ root, fetch: serving({ [GITHUB_HEAD]: archive() }, asked), approve: yes }, 'github:acme/hello');
    expect(asked).toEqual([GITHUB_HEAD]);
  });
});

describe('installPlugin from npm', () => {
  it('reads the registry entry, downloads its tarball and installs', async () => {
    const bytes = archive();
    const fetch = serving({ [NPM_META]: JSON.stringify({ dist: { tarball: NPM_TARBALL } }), [NPM_TARBALL]: bytes });
    const out = await installPlugin({ root, fetch, approve: yes }, 'feega-plugin-hello@1.0.0');
    expect(out).toEqual({ ok: true, id: 'acme.hello', version: '1.0.0' });
    expect(readRegistry(root).installed['acme.hello'].sha256).toBe(sha256(bytes));
  });

  it('refuses a tarball that does not live on the npm registry', async () => {
    const fetch = serving({ [NPM_META]: JSON.stringify({ dist: { tarball: 'https://evil.example/x.tgz' } }) });
    const out = await installPlugin({ root, fetch, approve: yes }, 'feega-plugin-hello@1.0.0');
    expect(out).toMatchObject({ ok: false, reason: expect.stringMatching(/registry/) });
  });
});

describe('what stops an install', () => {
  const refusals: [string, object, RegExp][] = [
    ['an unknown permission', { permissions: ['root'] }, /unknown permission/],
    ['a manifest that does not parse', { version: 'one' }, /version/]
  ];

  it.each(refusals)('refuses %s and writes nothing', async (_name, over, reason) => {
    const out = await installPlugin({ root, fetch: serving({ [GITHUB_TAG]: archive(over) }), approve: yes }, 'github:acme/hello@v1.0.0');
    expect(out).toMatchObject({ ok: false, reason: expect.stringMatching(reason) });
    expect(reviews).toEqual([]);
    expect(existsSync(registryPath(root))).toBe(false);
  });

  it('refuses an archive without a manifest', async () => {
    const out = await installPlugin({ root, fetch: serving({ [GITHUB_TAG]: tarball({ 'plugin.js': 'x' }) }), approve: yes }, 'github:acme/hello@v1.0.0');
    expect(out).toMatchObject({ ok: false, reason: expect.stringMatching(/feega-plugin\.json/) });
  });

  it('refuses an archive without the entry file', async () => {
    const out = await installPlugin({ root, fetch: serving({ [GITHUB_TAG]: tarball({ 'feega-plugin.json': manifest() }) }), approve: yes }, 'github:acme/hello@v1.0.0');
    expect(out).toMatchObject({ ok: false, reason: expect.stringMatching(/plugin\.js/) });
  });

  it('installs nothing when the user declines', async () => {
    const out = await installPlugin({ root, fetch: serving({ [GITHUB_TAG]: archive() }), approve: no }, 'github:acme/hello@v1.0.0');
    expect(out).toEqual({ ok: false, reason: 'not approved' });
    expect(existsSync(join(root, 'acme.hello'))).toBe(false);
    expect(existsSync(registryPath(root))).toBe(false);
  });

  it('refuses a source it cannot read', async () => {
    const out = await installPlugin({ root, fetch: serving({}), approve: yes }, 'https://evil.example/x.tgz');
    expect(out).toMatchObject({ ok: false, reason: expect.stringMatching(/source/) });
  });

  it('reports a failed download', async () => {
    const out = await installPlugin({ root, fetch: serving({}), approve: yes }, 'github:acme/hello@v1.0.0');
    expect(out).toMatchObject({ ok: false, reason: expect.stringMatching(/404/) });
  });
});

describe('pinning', () => {
  const add = (bytes: Uint8Array, tag = 'v1.0.0') => installPlugin({ root, fetch: serving({ [`https://codeload.github.com/acme/hello/tar.gz/refs/tags/${tag}`]: bytes }), approve: yes }, `github:acme/hello@${tag}`);

  it('refuses the same version when its archive changed', async () => {
    await add(archive());
    const out = await add(archive({}, { 'plugin.js': 'tampered' }));
    expect(out).toMatchObject({ ok: false, reason: expect.stringMatching(/changed/) });
    expect(readFileSync(join(root, 'acme.hello', '1.0.0', 'plugin.js'), 'utf8')).toBe('self.ready = 1;');
  });

  it('accepts the same archive again without asking', async () => {
    await add(archive());
    reviews.length = 0;
    expect(await add(archive())).toMatchObject({ ok: true });
    expect(reviews).toEqual([]);
  });

  it('updates only when added again, replacing the old version', async () => {
    await add(archive());
    const out = await add(archive({ version: '1.1.0' }), 'v1.1.0');
    expect(out).toEqual({ ok: true, id: 'acme.hello', version: '1.1.0' });
    expect(readRegistry(root).installed['acme.hello'].version).toBe('1.1.0');
    expect(existsSync(join(root, 'acme.hello', '1.0.0'))).toBe(false);
  });

  it('asks again when an update wants more permissions', async () => {
    await add(archive());
    reviews.length = 0;
    await add(archive({ version: '1.1.0', permissions: ['selection', 'edit.insert'] }), 'v1.1.0');
    expect(reviews).toHaveLength(1);
  });
});

describe('removePlugin', () => {
  it('forgets the plugin and deletes its files', async () => {
    await installPlugin({ root, fetch: serving({ [GITHUB_TAG]: archive() }), approve: yes }, 'github:acme/hello@v1.0.0');
    writeFileSync(registryPath(root), JSON.stringify(setEnabled(readRegistry(root), 'acme.hello', false)));
    expect(await removePlugin(root, 'acme.hello')).toEqual({ ok: true });
    expect(readRegistry(root)).toEqual({ installed: {}, disabled: [] });
    expect(existsSync(join(root, 'acme.hello'))).toBe(false);
  });

  it('says so when the plugin is not installed', async () => {
    expect(await removePlugin(root, 'nope')).toMatchObject({ ok: false });
  });
});
