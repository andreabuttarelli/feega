import { beforeEach, describe, expect, it } from 'vitest';
import { forgetSocialPublishing, socialPublishing } from './social-publishing';
import { SocialPublishing } from '$lib/social-publishing';
import type { Db } from '$lib/server/db/client';

function dbWith(row: { enabled: boolean } | null, reads: string[] = []): () => Db {
  return () =>
    ({
      from: (table: string) => ({
        select: () => ({
          eq: (_column: string, key: string) => ({
            maybeSingle: async () => {
              reads.push(`${table}:${key}`);
              return { data: row, error: null };
            }
          })
        })
      })
    }) as unknown as Db;
}

describe('socialPublishing', () => {
  beforeEach(() => forgetSocialPublishing());

  it('è spento se la riga non esiste (migration non applicata)', async () => {
    expect(await socialPublishing(dbWith(null), 0)).toBe(SocialPublishing.Off);
  });

  it('legge la riga social_publishing di feature_flags', async () => {
    const reads: string[] = [];
    expect(await socialPublishing(dbWith({ enabled: true }, reads), 0)).toBe(SocialPublishing.On);
    expect(reads).toEqual(['feature_flags:social_publishing']);
  });

  it('non rilegge il database a ogni richiesta', async () => {
    const reads: string[] = [];
    await socialPublishing(dbWith({ enabled: true }, reads), 0);
    await socialPublishing(dbWith({ enabled: true }, reads), 1_000);
    expect(reads).toHaveLength(1);
  });

  it('un errore di lettura lo lascia spento', async () => {
    const broken = () =>
      ({
        from: () => {
          throw new Error('down');
        }
      }) as unknown as Db;
    expect(await socialPublishing(broken, 0)).toBe(SocialPublishing.Off);
  });
});
