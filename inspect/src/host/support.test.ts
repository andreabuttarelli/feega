import { mkdtempSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SupportItem } from '../support';
import { fileSupportStore, globalStateSupportStore, memorySupportStore, type SupportStore } from './support';

const freshPath = () => join(mkdtempSync(join(tmpdir(), 'feega-support-')), 'feega', 'support.json');

const globalState = () => {
  const held = new Map<string, unknown>();
  return globalStateSupportStore({ get: (k: string) => held.get(k), update: async (k: string, v: unknown) => void held.set(k, v) });
};

const STORES: [string, () => SupportStore][] = [
  ['memory', memorySupportStore],
  ['file', () => fileSupportStore(freshPath())],
  ['global state', globalState]
];

describe.each(STORES)('the %s support store', (_name, make) => {
  it('starts empty and remembers each item once', async () => {
    const store = make();

    expect(await store.read()).toEqual([]);
    await store.mark(SupportItem.Star);
    await store.mark(SupportItem.Star);
    await store.mark(SupportItem.Coffee);

    expect(await store.read()).toEqual([SupportItem.Star, SupportItem.Coffee]);
  });
});

describe('the file support store', () => {
  it('is remembered by the next run on the same device', async () => {
    const path = freshPath();
    await fileSupportStore(path).mark(SupportItem.Discord);

    expect(await fileSupportStore(path).read()).toEqual([SupportItem.Discord]);
  });

  it('treats an unreadable file as empty', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'feega-support-')), 'support.json');
    await writeFile(path, '{nope');

    expect(await fileSupportStore(path).read()).toEqual([]);
  });

  it('ignores ids it does not know', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'feega-support-')), 'support.json');
    await writeFile(path, JSON.stringify({ done: ['star', 'bogus'] }));

    expect(await fileSupportStore(path).read()).toEqual([SupportItem.Star]);
  });
});
