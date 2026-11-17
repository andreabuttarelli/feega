import { describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { createMemoryDb } from '$lib/server/local/memory-db';
import supasito from '$lib/motion/fixtures/supasito-v1.json';

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-motion-revisions' } }));

const parses = vi.hoisted(() => ({ count: 0 }));
vi.mock('@feega/motion-core/motion/doc', async (original) => {
  const real = await original<typeof import('@feega/motion-core/motion/doc')>();
  return {
    ...real,
    parseMotionDoc: (input: unknown) => {
      parses.count += 1;
      return real.parseMotionDoc(input);
    }
  };
});

const { parseMotionDoc } = await import('@feega/motion-core/motion/doc');
const { appendRevision, readHead, readHeads, RevisionOutcome } = await import('./motion-revisions');

const ORG = 'org-a';
const NODE = '00000000-0000-4000-8000-0000000000b1';
const user = { kind: 'user' as const, id: 'u1' };

function memoryDb() {
  const tables = new Map<string, Record<string, unknown>[]>([['nodes', [{ id: NODE, org_id: ORG, type: 'motion', canvas_id: 'c1', deleted_at: null }]]]);
  return { db: createMemoryDb({ tables, blobs: new Map(), user: { id: 'u1', email: 'a@b.c', created_at: '2026-01-01' }, storageUrl: () => '', onChange: () => {} }) as unknown as Db, tables };
}

describe('a motion doc written by this server', () => {
  it('opens on a cold read without the full parse, equal to what the parse returns', async () => {
    const { db } = memoryDb();
    const written = await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: supasito, actor: user });
    expect(written.outcome).toBe(RevisionOutcome.Written);

    parses.count = 0;
    const heads = await readHeads(db, { orgId: ORG, heads: [{ nodeId: NODE, version: 1 }] });

    expect(parses.count).toBe(0);
    expect(heads.get(NODE)!.doc).toEqual((parseMotionDoc(supasito) as { doc: unknown }).doc);
  });

  it('a row written by an older release still opens through the full parse', async () => {
    const { db, tables } = memoryDb();
    tables.set('motion_revisions', [{ org_id: ORG, node_id: NODE, version: 1, doc: supasito, summary: null, actor_kind: 'user' }]);

    parses.count = 0;
    const head = await readHead(db, { orgId: ORG, nodeId: NODE });

    expect(parses.count).toBe(1);
    expect(head!.doc).toEqual((parseMotionDoc(supasito) as { doc: unknown }).doc);
  });
});
