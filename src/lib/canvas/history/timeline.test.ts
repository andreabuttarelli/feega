import { describe, expect, it } from 'vitest';
import { EntryKind, HistoryFilter, HistorySource, LaneKind, historyGraph, laneOf, laneSpans, type HistoryEntry } from './timeline';

const entry = (id: string, at: string, author: HistoryEntry['author'], extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id,
  source: HistorySource.Event,
  kind: EntryKind.NodeUpdate,
  at,
  author,
  nodeId: null,
  frameId: null,
  summary: null,
  ...extra
});

const marco = { kind: 'user' as const, id: 'u-marco', agentKey: null };
const chat = { kind: 'agent' as const, id: 'u-marco', agentKey: 'sidebar' };
const claude = { kind: 'agent' as const, id: 'u-marco', agentKey: 'claude-code' };
const system = { kind: 'system' as const, id: null, agentKey: null };

describe('laneOf gives every author its own lane', () => {
  it('a person, the sidebar chat, an outside agent and the system are four kinds', () => {
    expect([marco, chat, claude, system].map((a) => laneOf(a, {}).kind)).toEqual([LaneKind.Person, LaneKind.Chat, LaneKind.Agent, LaneKind.System]);
  });

  it('two people are two lanes, the same agent key is one lane whoever runs it', () => {
    expect(laneOf(marco, {}).key).not.toBe(laneOf({ ...marco, id: 'u-anna' }, {}).key);
    expect(laneOf(claude, {}).key).toBe(laneOf({ ...claude, id: 'u-anna' }, {}).key);
  });

  it('a lane keeps its colour across reads', () => {
    expect(laneOf(claude, {}).colour).toBe(laneOf(claude, {}).colour);
  });
});

describe('historyGraph merges every source into one newest-first timeline', () => {
  const entries = [
    entry('a', '2026-10-29T10:00:00Z', marco),
    entry('b', '2026-10-29T12:00:00Z', claude, { source: HistorySource.Revision, frameId: 'f1' }),
    entry('c', '2026-10-29T11:00:00Z', chat, { nodeId: 'f1' }),
    entry('d', '2026-10-29T09:00:00Z', system)
  ];

  it('orders by time and puts each row on its author lane', () => {
    const graph = historyGraph(entries, { filter: HistoryFilter.All, names: { 'u-marco': 'Marco' } });

    expect(graph.rows.map((r) => r.entry.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(graph.lanes.map((l) => l.label)).toEqual(['claude-code', 'Chat', 'Marco', 'System']);
    expect(graph.rows.map((r) => r.lane)).toEqual([0, 1, 2, 3]);
  });

  it('AI keeps chat and agents, People keeps people', () => {
    const ai = historyGraph(entries, { filter: HistoryFilter.Ai, names: {} });
    const people = historyGraph(entries, { filter: HistoryFilter.People, names: {} });

    expect(ai.rows.map((r) => r.entry.id)).toEqual(['b', 'c']);
    expect(people.rows.map((r) => r.entry.id)).toEqual(['a']);
  });

  it('one frame keeps the changes to that frame and inside it', () => {
    const graph = historyGraph(entries, { filter: HistoryFilter.All, frameId: 'f1', names: {} });

    expect(graph.rows.map((r) => r.entry.id)).toEqual(['b', 'c']);
  });

  it('a limit keeps the newest', () => {
    expect(historyGraph(entries, { filter: HistoryFilter.All, names: {}, limit: 1 }).rows.map((r) => r.entry.id)).toEqual(['b']);
  });
});

describe('laneSpans draws each lane from its newest to its oldest row', () => {
  it('a lane is live between its first and last row, and only there', () => {
    const graph = historyGraph(
      [entry('a', '2026-10-29T12:00:00Z', marco), entry('b', '2026-10-29T11:00:00Z', claude), entry('c', '2026-10-29T10:00:00Z', marco)],
      { filter: HistoryFilter.All, names: {} }
    );

    expect(laneSpans(graph)).toEqual([{ first: 0, last: 2 }, { first: 1, last: 1 }]);
  });
});
