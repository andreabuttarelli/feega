import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { isSupportItem, type SupportItem } from '../support';

export type SupportStore = {
  read: () => Promise<SupportItem[]>;
  mark: (item: SupportItem) => Promise<unknown>;
};

const GLOBAL_KEY = 'feegaInspect.support';
const SUPPORT_FILE = join('.config', 'feega', 'support.json');

export const supportPath = (home: string = homedir()) => join(home, SUPPORT_FILE);

const known = (value: unknown): SupportItem[] => (Array.isArray(value) ? [...new Set(value.filter(isSupportItem))] : []);

const withItem = (done: SupportItem[], item: SupportItem): SupportItem[] => (done.includes(item) ? done : [...done, item]);

export const memorySupportStore = (): SupportStore => {
  let done: SupportItem[] = [];
  return { read: async () => done, mark: async (item) => void (done = withItem(done, item)) };
};

export const globalStateSupportStore = (state: { get: (key: string) => unknown; update: (key: string, value: unknown) => PromiseLike<unknown> }): SupportStore => ({
  read: async () => known(state.get(GLOBAL_KEY)),
  mark: async (item) => state.update(GLOBAL_KEY, withItem(known(state.get(GLOBAL_KEY)), item))
});

export const fileSupportStore = (path: string = supportPath()): SupportStore => {
  const read = async () => {
    try {
      return known(JSON.parse(readFileSync(path, 'utf8')).done);
    } catch {
      return [];
    }
  };

  return {
    read,
    mark: async (item) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify({ done: withItem(await read(), item) }));
    }
  };
};
