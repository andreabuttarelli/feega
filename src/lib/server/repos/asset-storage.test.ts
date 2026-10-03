import { describe, expect, it } from 'vitest';
import { CANVAS_REDIRECT_MAX_AGE_S, SIGNED_URL_TTL_S, signAssetFiles } from './asset-storage';
import { REUSABLE_SHARE_OF_TTL } from '$lib/server/media-thumbnails';
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

describe('signed URL lifetimes', () => {
  it('canvas media lives a day, what a model provider fetches five minutes, a server render fifteen', () => {
    expect(SIGNED_URL_TTL_S).toEqual({ canvas: 86_400, agentPreview: 300, providerInput: 300, userLink: 3600, render: 900 });
  });

  it('a cached redirect to the oldest reused URL still lands before that URL expires', () => {
    const oldestReusedAge = SIGNED_URL_TTL_S.canvas * REUSABLE_SHARE_OF_TTL;

    expect(oldestReusedAge + CANVAS_REDIRECT_MAX_AGE_S).toBeLessThan(SIGNED_URL_TTL_S.canvas);
    expect(CANVAS_REDIRECT_MAX_AGE_S).toBe(21_600);
  });
});
