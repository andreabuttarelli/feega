import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { allowedIds, applyAllowlist } from './allowlist';

const choice = (id: string) => ({ id, label: id, aspectRatios: [] }) as never;

describe('org model allow-list', () => {
  it('an org with no rows offers every model', async () => {
    const { db } = fakeDb({ org_model_allowlist: [] }, { filter: true });

    expect(await allowedIds(db as never, 'org-1', 'image')).toBeNull();
  });

  it('rows restrict a medium to the listed ids', async () => {
    const { db } = fakeDb(
      {
        org_model_allowlist: [
          { org_id: 'org-1', medium: 'image', model_id: 'a' },
          { org_id: 'org-1', medium: 'video', model_id: 'v' },
          { org_id: 'org-2', medium: 'image', model_id: 'b' }
        ]
      },
      { filter: true }
    );

    expect(await allowedIds(db as never, 'org-1', 'image')).toEqual(new Set(['a']));
  });

  it('a missing table offers every model', async () => {
    const db = { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: null, error: { code: '42P01' } }) }) }) }) };

    expect(await allowedIds(db as never, 'org-1', 'image')).toBeNull();
  });

  it('keeps only the listed choices, and all when there is no list', () => {
    const choices = [choice('a'), choice('b')];

    expect(applyAllowlist(choices, new Set(['b'])).map((c) => c.id)).toEqual(['b']);
    expect(applyAllowlist(choices, null)).toBe(choices);
  });
});
