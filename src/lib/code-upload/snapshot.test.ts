import { describe, expect, it } from 'vitest';
import { gunzipSync, strToU8 } from 'fflate';
import { ignoredBy, keptDir, rulesOf, snapshotOf, SnapshotRefusal, SNAPSHOT_LIMITS, type PickedFile } from './snapshot';
import { untarred } from './tar';

const file = (path: string, text: string): PickedFile => ({ path, size: strToU8(text).length, bytes: async () => strToU8(text) });
const sized = (path: string, size: number): PickedFile => ({ path, size, bytes: async () => new Uint8Array(size) });

describe('gitignore rules', () => {
  const rules = rulesOf('', '# deps\n*.log\n/secret.env\ncache/\n!keep.log\nsrc/**/gen\n');

  it('a bare pattern matches at any depth', () => {
    expect(ignoredBy(rules, 'a/b/debug.log', false)).toBe(true);
  });

  it('a negation keeps a file back', () => {
    expect(ignoredBy(rules, 'keep.log', false)).toBe(false);
  });

  it('a leading slash anchors to the folder root', () => {
    expect(ignoredBy(rules, 'secret.env', false)).toBe(true);
    expect(ignoredBy(rules, 'nested/secret.env', false)).toBe(false);
  });

  it('a trailing slash matches only directories', () => {
    expect(ignoredBy(rules, 'cache', true)).toBe(true);
    expect(ignoredBy(rules, 'cache', false)).toBe(false);
  });

  it('a double star crosses directories', () => {
    expect(ignoredBy(rules, 'src/a/b/gen', true)).toBe(true);
  });

  it('a nested .gitignore applies under its own directory only', () => {
    const nested = rulesOf('web', 'tmp\n');
    expect(ignoredBy(nested, 'web/tmp', true)).toBe(true);
    expect(ignoredBy(nested, 'tmp', true)).toBe(false);
  });
});

describe('the folder snapshot', () => {
  it('build output and dependencies are never walked', () => {
    expect(['node_modules', '.git', 'dist', '.next', '.svelte-kit'].map(keptDir)).toEqual([false, false, false, false, false]);
    expect(keptDir('src')).toBe(true);
  });

  it('packs the kept files under the folder name and leaves out the ignored ones', async () => {
    const done = await snapshotOf('my app', [file('package.json', '{}'), file('.gitignore', '*.log\n'), file('src/main.ts', 'x'), file('debug.log', 'no'), file('node_modules/a/index.js', 'no'), sized('assets/huge.mp4', SNAPSHOT_LIMITS.fileBytes + 1)]);

    expect(done.ok).toBe(true);
    if (!done.ok) {
      return;
    }
    expect(done.name).toBe('my-app');
    const files = untarred(gunzipSync(done.archive));
    expect([...files.keys()].sort()).toEqual(['.gitignore', 'package.json', 'src/main.ts']);
    expect(done.skipped).toEqual(['assets/huge.mp4']);
  });

  it('a folder without package.json is refused', async () => {
    const done = await snapshotOf('x', [file('index.html', '<p>')]);
    expect(done).toEqual({ ok: false, refusal: SnapshotRefusal.NoPackage });
  });

  it('a folder over the total cap is refused before anything is read', async () => {
    const many = Array.from({ length: 30 }, (_, i) => sized(`src/f${i}.ts`, SNAPSHOT_LIMITS.fileBytes));
    const done = await snapshotOf('x', [file('package.json', '{}'), ...many]);
    expect(done).toEqual({ ok: false, refusal: SnapshotRefusal.TooBig });
  });
});

describe('secrets in a picked folder', () => {
  const pathsOf = async (picked: PickedFile[]) => {
    const snap = await snapshotOf('app', picked);
    return snap.ok ? [...untarred(gunzipSync(snap.archive)).keys()] : [];
  };

  it('env files and key material never leave the browser, whatever .gitignore says', async () => {
    const secrets = ['.env', '.env.local', 'web/.env.production', 'cert.pem', 'tls/server.key', 'id_rsa', '.ssh/id_rsa.pub'];
    const kept = await pathsOf([file('package.json', '{}'), file('.gitignore', '!.env\n'), ...secrets.map((p) => file(p, 'SECRET=1'))]);

    expect(kept.filter((p) => secrets.includes(p))).toEqual([]);
  });

  it('env templates stay', async () => {
    const templates = ['.env.example', '.env.sample', '.env.template'];
    const kept = await pathsOf([file('package.json', '{}'), ...templates.map((p) => file(p, 'KEY='))]);

    expect(kept).toEqual(expect.arrayContaining(templates));
  });

  it('an .npmrc goes only without an auth token', async () => {
    const withToken = await pathsOf([file('package.json', '{}'), file('.npmrc', '//registry.npmjs.org/:_authToken=npm_abc\n')]);
    const plain = await pathsOf([file('package.json', '{}'), file('.npmrc', 'engine-strict=true\n')]);

    expect(withToken).not.toContain('.npmrc');
    expect(plain).toContain('.npmrc');
  });

  it('reports what it withheld', async () => {
    const snap = await snapshotOf('app', [file('package.json', '{}'), file('.env', 'A=1')]);

    expect(snap.ok && snap.withheld).toEqual(['.env']);
  });
});
