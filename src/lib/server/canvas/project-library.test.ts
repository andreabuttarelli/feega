import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { adoptDocLibrary } from './project-library';

const HEADLINE = { kind: 'text', size: 0.2 };

describe('a doc brought into the project', () => {
  it('adds its styles and its collections to the project library, without the frame mode', async () => {
    const { db, calls } = fakeDb({});
    const doc = { styles: { Headline: HEADLINE }, variables: { Site: { modes: ['Default'], active: 'Default', vars: {} } } } as never;

    await adoptDocLibrary(db, { orgId: 'org-1', projectId: 'p-1' }, doc);

    const upserts = calls.filter((c) => c.op === 'upsert').map((c) => c.payload);
    expect(upserts).toEqual([
      [{ org_id: 'org-1', project_id: 'p-1', kind: 'style', name: 'Headline', value: HEADLINE }],
      [{ org_id: 'org-1', project_id: 'p-1', kind: 'variables', name: 'Site', value: { modes: ['Default'], vars: {} } }]
    ]);
  });

  it('a doc with neither leaves the library alone', async () => {
    const { db, calls } = fakeDb({});

    await adoptDocLibrary(db, { orgId: 'org-1', projectId: 'p-1' }, {} as never);

    expect(calls.filter((c) => c.op === 'upsert')).toEqual([]);
  });
});
