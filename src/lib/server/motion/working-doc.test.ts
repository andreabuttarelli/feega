import { describe, expect, it } from 'vitest';
import type { FrameBucket } from './frame-store';
import { keepWorkingDoc, readWorkingDoc } from './working-doc';

const RLS = 'new row violates row-level security policy';

function insertOnlyBucket() {
  const objects = new Map<string, string>();
  const bucket: FrameBucket = {
    upload: async (path, bytes) => {
      if (objects.has(path)) {
        return { error: { message: RLS } };
      }
      objects.set(path, bytes.toString());
      return { error: null };
    },
    list: async () => ({ data: [], error: null }),
    download: async (path) => ({ data: objects.has(path) ? new Blob([objects.get(path)!]) : null, error: null }),
    remove: async (paths) => {
      paths.forEach((p) => objects.delete(p));
      return { error: null };
    }
  };
  return bucket;
}

const scope = { orgId: 'o-1', projectId: 'p-1', nodeId: 'n-1' };
const doc = (title: string) => ({ title }) as never;

describe('the working doc', () => {
  it('canvas-assets has no update policy: the second edit of a turn still replaces the first (prod: every keep after the first refused by RLS)', async () => {
    const bucket = insertOnlyBucket();

    await keepWorkingDoc({ ...scope, bucket }, { edit: 1, doc: doc('first') });
    await keepWorkingDoc({ ...scope, bucket }, { edit: 2, doc: doc('second') });

    expect(await readWorkingDoc({ ...scope, bucket })).toEqual({ edit: 2, doc: doc('second') });
  });
});
