import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { HistoryFilter, HistorySource } from '$lib/canvas/history/timeline';
import { readHistory } from './history';

const ORG = 'org-1';
const CANVAS = 'c-1';
const FRAME = 'frame-1';
const BRANCH = 'branch-1';
const MARCO = 'u-marco';

const node = (id: string, type: string, data: Record<string, unknown> = {}) => ({ id, org_id: ORG, canvas_id: CANVAS, project_id: 'p-1', type, display_name: null, x: 0, y: 0, z: 0, width: null, height: null, data, version: 1, deleted_at: null });

const rows = () => ({
  nodes: [node(FRAME, 'motion'), node('text-1', 'text'), node(BRANCH, 'motion', { branchOf: { nodeId: FRAME, baseVersion: 3, name: 'Bolder' } })],
  canvas_events: [{ id: 7, org_id: ORG, canvas_id: CANVAS, kind: 'node.update', node_id: 'text-1', edge_id: null, before: {}, after: {}, actor_kind: 'user', actor_id: MARCO, agent_key: null, created_at: '2026-10-29T10:00:00Z' }],
  canvas_versions: [{ id: 'v-1', org_id: ORG, canvas_id: CANVAS, name: 'Launch', created_at: '2026-10-29T11:00:00Z', snapshot: { nodes: [], connections: [] }, actor_kind: 'user', actor_id: MARCO, agent_key: null }],
  motion_revisions: [
    { org_id: ORG, node_id: FRAME, version: 4, summary: 'Bigger title', actor_kind: 'agent', actor_id: MARCO, agent_key: 'claude-code', created_at: '2026-10-29T12:00:00Z' },
    { org_id: ORG, node_id: BRANCH, version: 1, summary: 'Branched from version 3', actor_kind: 'agent', actor_id: MARCO, agent_key: 'sidebar', created_at: '2026-10-29T13:00:00Z' }
  ],
  profiles: [{ id: MARCO, name: 'Marco', email: 'marco@example.com' }]
});

describe('readHistory merges the canvas logs into one timeline', () => {
  it('events, versions, frame revisions and branches, newest first, on author lanes', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    const graph = await readHistory(db, { orgId: ORG, canvasId: CANVAS, filter: HistoryFilter.All });

    expect(graph.rows.map((r) => [r.entry.source, r.entry.kind])).toEqual([
      [HistorySource.Branch, 'branch.create'],
      [HistorySource.Revision, 'revision.commit'],
      [HistorySource.Version, 'version.save'],
      [HistorySource.Event, 'node.update']
    ]);
    expect(graph.rows[0].entry).toMatchObject({ nodeId: BRANCH, frameId: FRAME, summary: 'Bolder' });
    expect(graph.lanes.map((l) => l.label)).toEqual(['Chat', 'claude-code', 'Marco']);
  });

  it('one frame keeps its revisions and its branches', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    const graph = await readHistory(db, { orgId: ORG, canvasId: CANVAS, filter: HistoryFilter.All, frameId: FRAME });

    expect(graph.rows.map((r) => r.entry.kind)).toEqual(['branch.create', 'revision.commit']);
  });

  it('every read is scoped to the org', async () => {
    const { db, calls } = fakeDb(rows(), { filter: true });

    await readHistory(db, { orgId: ORG, canvasId: CANVAS, filter: HistoryFilter.People });

    expect(calls.filter((c) => c.table !== 'profiles').every((c) => c.filters.some(([col, v]) => col === 'org_id' && v === ORG))).toBe(true);
  });

  it('a refused write is a conflict row on the lane of who was refused, closed ones say which side won', async () => {
    const conflict = (id: string, at: string, resolution: string | null) => ({ id, org_id: ORG, canvas_id: CANVAS, node_id: 'text-1', expected_version: 3, actual_version: 5, attempt: 'replace', attempted: {}, winning_event_id: 7, actor_kind: 'user', actor_id: MARCO, agent_key: null, resolution, resolved_at: resolution ? at : null, created_at: at });
    const { db } = fakeDb({ ...rows(), canvas_conflicts: [conflict('k-1', '2026-10-29T14:00:00Z', null), conflict('k-2', '2026-10-29T13:30:00Z', 'mine')] }, { filter: true });

    const graph = await readHistory(db, { orgId: ORG, canvasId: CANVAS, filter: HistoryFilter.People });

    expect(graph.rows.slice(0, 2).map((r) => [r.entry.id, r.entry.kind, r.entry.nodeId, r.entry.summary])).toEqual([
      ['conflict:k-1', 'conflict.open', 'text-1', null],
      ['conflict:k-2', 'conflict.resolved', 'text-1', 'mine']
    ]);
  });
});
