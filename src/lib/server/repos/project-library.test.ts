import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { LibraryKind } from '$lib/motion/project-library-ops';
import { adoptEntries, listEntries, removeEntry, renameEntry, saveEntry } from './project-library';

const SCOPE = { orgId: 'org-1', projectId: 'p-1', kind: LibraryKind.Style };
const HEADLINE = { kind: 'text', size: 0.2 };

describe('the project library', () => {
  it('lists the entries of one kind for the project, scoped to its org', async () => {
    const { db, calls } = fakeDb({ project_library: [{ name: 'Headline', value: HEADLINE, kind: 'style', org_id: 'org-1', project_id: 'p-1' }, { name: 'Brand', value: {}, kind: 'variables', org_id: 'org-1', project_id: 'p-1' }] }, { filter: true });

    expect(await listEntries(db, SCOPE)).toEqual({ Headline: HEADLINE });
    expect(calls[0].filters).toEqual(expect.arrayContaining([['org_id', 'org-1'], ['project_id', 'p-1'], ['kind', 'style']]));
  });

  it('a missing table reads as an empty library, not an error', async () => {
    const missing = { data: null, error: { code: '42P01', message: 'missing' } };
    const chain: Record<string, unknown> = { eq: () => chain, then: (resolve: (v: unknown) => unknown) => resolve(missing) };
    const broken = { from: () => ({ select: () => chain }) } as never;

    expect(await listEntries(broken, SCOPE)).toEqual({});
  });

  it('saving upserts on the project, kind and name', async () => {
    const { db, calls } = fakeDb({});

    await saveEntry(db, SCOPE, 'Headline', HEADLINE);

    expect(calls[0]).toMatchObject({ table: 'project_library', op: 'upsert', payload: { org_id: 'org-1', project_id: 'p-1', kind: 'style', name: 'Headline', value: HEADLINE } });
  });

  it('adopting entries found in frames never overwrites one the project has', async () => {
    const { db, calls } = fakeDb({});

    await adoptEntries(db, SCOPE, { Headline: HEADLINE }, { Headline: { size: 0.9 }, Body: HEADLINE });

    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toEqual([{ org_id: 'org-1', project_id: 'p-1', kind: 'style', name: 'Body', value: HEADLINE }]);
  });

  it('rename and remove act on one name of one kind', async () => {
    const { db, calls } = fakeDb({});

    await renameEntry(db, SCOPE, 'Headline', 'Display');
    await removeEntry(db, SCOPE, 'Display');

    expect(calls[0]).toMatchObject({ op: 'update', payload: { name: 'Display' } });
    expect(calls[0].filters).toEqual(expect.arrayContaining([['name', 'Headline'], ['kind', 'style']]));
    expect(calls[1]).toMatchObject({ op: 'delete' });
    expect(calls[1].filters).toEqual(expect.arrayContaining([['name', 'Display'], ['org_id', 'org-1']]));
  });
});
