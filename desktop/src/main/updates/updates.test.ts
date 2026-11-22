import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matchesHash, sha512OfFile } from './hash';
import { fileFor, parseManifest } from './manifest';
import { Strategy, updaterRow } from './strategy';
import { darwinSwapPlan, StepKind } from './swap-plan';
import { isNewer } from './version';

describe('isNewer', () => {
  it('compares numbers, not strings', () => {
    expect(isNewer('0.1.0', '0.1.1')).toBe(true);
    expect(isNewer('0.9.0', '0.10.0')).toBe(true);
    expect(isNewer('1.0.0', '0.99.99')).toBe(false);
  });

  it('is false for the same version and for garbage', () => {
    expect(isNewer('1.2.3', '1.2.3')).toBe(false);
    expect(isNewer('1.2.3', 'latest')).toBe(false);
    expect(isNewer('nope', '1.2.3')).toBe(false);
  });

  it('puts a prerelease before its release', () => {
    expect(isNewer('1.0.0-beta.1', '1.0.0')).toBe(true);
    expect(isNewer('1.0.0', '1.0.0-beta.1')).toBe(false);
  });
});

describe('parseManifest', () => {
  const sample = { version: '0.2.0', files: { arm64: { url: 'https://example.com/a.zip', sha512: 'abc' }, x64: { url: 'https://example.com/b.zip', sha512: 'def' } } };

  it('reads a valid manifest and finds the file for an arch', () => {
    const manifest = parseManifest(sample);

    expect(manifest?.version).toBe('0.2.0');
    expect(fileFor(manifest!, 'arm64')).toEqual({ url: 'https://example.com/a.zip', sha512: 'abc' });
  });

  it('refuses a manifest without a version or files', () => {
    expect(parseManifest({ files: sample.files })).toBeNull();
    expect(parseManifest({ version: '0.2.0' })).toBeNull();
    expect(parseManifest('text')).toBeNull();
    expect(parseManifest(null)).toBeNull();
  });

  it('refuses plain http except on loopback', () => {
    expect(parseManifest({ version: '1.0.0', files: { arm64: { url: 'http://evil.example.com/a.zip', sha512: 'x' } } })?.files.arm64).toBeUndefined();
    expect(parseManifest({ version: '1.0.0', files: { arm64: { url: 'http://127.0.0.1:8123/a.zip', sha512: 'x' } } })?.files.arm64).toBeDefined();
  });

  it('has no file for an arch that was not published', () => {
    expect(fileFor(parseManifest({ version: '1.0.0', files: { arm64: sample.files.arm64 } })!, 'x64')).toBeNull();
  });
});

describe('hash check', () => {
  const data = Buffer.from('feega update payload');
  const digest = createHash('sha512').update(data).digest();

  it('accepts the hex or base64 form of the real digest', () => {
    expect(matchesHash(digest, digest.toString('hex'))).toBe(true);
    expect(matchesHash(digest, digest.toString('base64'))).toBe(true);
  });

  it('rejects anything else', () => {
    expect(matchesHash(digest, createHash('sha512').update('other').digest('hex'))).toBe(false);
    expect(matchesHash(digest, '')).toBe(false);
  });

  it('hashes a file on disk', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'feega-hash-')), 'payload.zip');
    writeFileSync(file, data);

    expect((await sha512OfFile(file)).equals(digest)).toBe(true);
  });
});

describe('darwin swap plan', () => {
  const plan = darwinSwapPlan({ current: '/Applications/Feega.app', fresh: '/data/updates/0.2.0/Feega.app', backup: '/data/updates/old/Feega.app', relaunch: true, pid: 4242 });

  it('moves the old bundle aside, copies the new one in and relaunches', () => {
    expect(plan.steps.map((s) => s.kind)).toEqual([StepKind.Move, StepKind.Copy, StepKind.Relaunch]);
    expect(plan.steps[0]).toMatchObject({ from: '/Applications/Feega.app', to: '/data/updates/old/Feega.app' });
    expect(plan.steps[1]).toMatchObject({ from: '/data/updates/0.2.0/Feega.app', to: '/Applications/Feega.app' });
    expect(plan.steps[2]).toMatchObject({ path: '/Applications/Feega.app', pid: 4242 });
  });

  it('can put the old bundle back when the copy fails', () => {
    expect(plan.rollback).toEqual([{ kind: StepKind.Remove, path: '/Applications/Feega.app' }, { kind: StepKind.Move, from: '/data/updates/old/Feega.app', to: '/Applications/Feega.app' }]);
  });

  it('skips the relaunch when applying on quit', () => {
    const quiet = darwinSwapPlan({ current: '/A/Feega.app', fresh: '/B/Feega.app', backup: '/C/Feega.app', relaunch: false, pid: 1 });

    expect(quiet.steps.map((s) => s.kind)).toEqual([StepKind.Move, StepKind.Copy]);
  });
});

describe('updater table', () => {
  it('uses our own swap on macOS and electron-updater elsewhere', () => {
    expect(updaterRow('darwin').strategy).toBe(Strategy.DarwinSwap);
    expect(updaterRow('win32').strategy).toBe(Strategy.ElectronUpdater);
    expect(updaterRow('linux').strategy).toBe(Strategy.ElectronUpdater);
  });

  it('does nothing on a platform it does not know', () => {
    expect(updaterRow('sunos').strategy).toBe(Strategy.None);
  });
});
