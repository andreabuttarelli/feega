import { describe, expect, it, vi } from 'vitest';
import { createMemoryDb, type Row } from '$lib/server/local/memory-db';
import type { Db } from '$lib/server/db/client';
import { FREE_AGENT_LAYERS_PER_WEEK } from '$lib/credit-ladder';
import { agentEditCap, agentEditUsage, AGENT_EDIT_CAP } from './cap';

const ORG = 'org-1';
const NOW = new Date('2026-11-13T12:00:00Z');
const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString();

const event = (created_at: string, actor_kind = 'agent', kind = 'node.update', org_id = ORG, agent_key = 'mcp') => ({ id: crypto.randomUUID(), org_id, kind, actor_kind, agent_key, created_at });
const revision = (created_at: string, actor_kind = 'agent', layers_touched: number | null = 1, agent_key = 'sidebar') => ({ id: crypto.randomUUID(), org_id: ORG, actor_kind, agent_key, layers_touched, created_at });

function world(opts: { paid?: boolean; events?: Row[]; revisions?: Row[] }): Db {
  return createMemoryDb({
    tables: new Map<string, Row[]>([
      ['orgs', [{ id: ORG, stripe_subscription_id: opts.paid ? 'sub_1' : null }]],
      ['canvas_events', opts.events ?? []],
      ['motion_revisions', opts.revisions ?? []]
    ]),
    blobs: new Map(),
    user: { id: 'u1', email: 'a@b.c', created_at: '2026-01-01' },
    storageUrl: () => '',
    onChange: () => {}
  }) as unknown as Db;
}

const many = (n: number, at: string) => Array.from({ length: n }, () => event(at));

describe('the weekly cap on agent edits, free teams only', () => {
  it('is 1,000 layers a week, one constant next to the plan', () => {
    expect(FREE_AGENT_LAYERS_PER_WEEK).toBe(1000);
  });

  it('lets agents edit while the week has room', async () => {
    expect(await agentEditCap(world({ events: many(999, daysAgo(1)) }), ORG, NOW)).toBeNull();
  });

  it('refuses at the cap, saying how many, the limit, when room frees up and where to upgrade', async () => {
    const db = world({ events: [...many(600, daysAgo(2)), event(daysAgo(6))], revisions: Array.from({ length: 399 }, () => revision(daysAgo(1))) });

    expect(await agentEditCap(db, ORG, NOW)).toEqual({
      error: AGENT_EDIT_CAP,
      used: 1000,
      limit: 1000,
      resets_at: new Date(NOW.getTime() + DAY_MS).toISOString(),
      upgrade_path: '/app/credits',
      message: expect.stringMatching(/0 of its 1,000 weekly agent edits left.*Subscribe/)
    });
  });

  it('never counts human edits, edges, other teams or edits older than seven days', async () => {
    const db = world({
      events: [...many(999, daysAgo(1)), event(daysAgo(1), 'user'), event(daysAgo(1), 'agent', 'edge.create'), event(daysAgo(1), 'agent', 'node.update', 'other'), event(daysAgo(8))]
    });

    expect(await agentEditCap(db, ORG, NOW)).toBeNull();
  });

  it('a count that fails never blocks an agent: it is logged and the edit goes on', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) } as unknown as Db;

    expect(await agentEditCap(broken, ORG, NOW)).toBeNull();
    expect(error).toHaveBeenCalled();
  });

  it('never counts what a person launched and an agent actor carried out: loops, workflows, studio batches, compose', async () => {
    const launched = ['loop', 'workflow', 'studio', 'compose'].flatMap((key) => Array.from({ length: 300 }, () => event(daysAgo(1), 'agent', 'node.create', ORG, key)));

    expect(await agentEditCap(world({ events: [...many(10, daysAgo(1)), ...launched] }), ORG, NOW)).toBeNull();
  });

  it('counts a frame revision by the layers it touched, not as one', async () => {
    const db = world({ events: many(500, daysAgo(1)), revisions: [revision(daysAgo(1), 'agent', 500)] });

    expect(await agentEditCap(db, ORG, NOW)).toMatchObject({ used: 1000 });
  });

  it('refuses a batch bigger than what is left, saying how many remain', async () => {
    const db = world({ events: many(999, daysAgo(1)) });

    expect(await agentEditCap(db, ORG, NOW, 500)).toMatchObject({ error: AGENT_EDIT_CAP, used: 999, message: expect.stringMatching(/has 1 of its 1,000 weekly agent edits left.*would change 500/) });
    expect(await agentEditCap(db, ORG, NOW, 1)).toBeNull();
  });

  it('a paying team is never capped', async () => {
    expect(await agentEditCap(world({ paid: true, events: many(5000, daysAgo(1)) }), ORG, NOW)).toBeNull();
  });
});

describe('agentEditUsage, what the credits page shows', () => {
  it('counts this week for a free team', async () => {
    expect(await agentEditUsage(world({ events: many(640, daysAgo(2)) }), ORG, NOW)).toEqual({ used: 640, limit: 1000 });
  });

  it('shows nothing for a paying team', async () => {
    expect(await agentEditUsage(world({ paid: true, events: many(640, daysAgo(2)) }), ORG, NOW)).toBeNull();
  });
});
