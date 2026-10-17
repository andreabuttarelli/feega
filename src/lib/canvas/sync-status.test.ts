import { describe, expect, it } from 'vitest';
import { SaveStatus } from './save-scheduler';
import { SyncState, syncOf } from './sync-status';

describe('syncOf: one quiet status for everything still unsent', () => {
  it('is saved only when nodes, placements and lines all landed', () => {
    expect(syncOf({ nodes: SaveStatus.Saved, places: SaveStatus.Saved, unsent: 0, online: true })).toEqual({ state: SyncState.Saved, label: 'Saved' });
  });

  it('says saving while anything is on its way', () => {
    expect(syncOf({ nodes: SaveStatus.Saved, places: SaveStatus.Saving, unsent: 0, online: true }).state).toBe(SyncState.Saving);
    expect(syncOf({ nodes: SaveStatus.Saved, places: SaveStatus.Saved, unsent: 2, online: true }).state).toBe(SyncState.Saving);
  });

  it('says offline with the count of changes waiting', () => {
    expect(syncOf({ nodes: SaveStatus.Saving, places: SaveStatus.Saved, unsent: 3, online: false })).toEqual({ state: SyncState.Offline, label: 'Offline — 3 changes waiting' });
  });

  it('says retrying when the server keeps failing while online', () => {
    expect(syncOf({ nodes: SaveStatus.Retrying, places: SaveStatus.Saved, unsent: 1, online: true }).state).toBe(SyncState.Retrying);
  });
});
