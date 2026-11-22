import type { IndexEntry, ItemFile, LibraryStore } from '../library';

export type FakeStore = LibraryStore & { reads: string[] };

export function fakeStore(index: IndexEntry[], files: Record<string, ItemFile[]>): FakeStore {
  const reads: string[] = [];

  return {
    reads,
    async index() {
      reads.push('index');

      return index;
    },
    async files(id, framework) {
      reads.push(`${id}/${framework}`);

      return files[`${id}/${framework}`] ?? null;
    }
  };
}
