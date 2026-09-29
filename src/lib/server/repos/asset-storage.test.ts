import { describe, expect, it } from 'vitest';
import { signAssetFiles } from './asset-storage';
import type { Db } from '$lib/server/db/client';

function dbWithoutStorage(): Db {
  return {
    get storage(): never {
      throw new Error('db.storage touched with nothing to sign');
    }
  } as unknown as Db;
}

describe('signAssetFiles', () => {
  it('never touches storage when there is nothing to sign', async () => {
    const signed = await signAssetFiles(dbWithoutStorage(), []);

    expect(signed.size).toBe(0);
  });
});
