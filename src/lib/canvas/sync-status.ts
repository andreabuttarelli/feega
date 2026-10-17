import { SaveStatus } from './save-scheduler';

export enum SyncState {
  Saved = 'saved',
  Saving = 'saving',
  Retrying = 'retrying',
  Offline = 'offline'
}

type SyncInput = { nodes: SaveStatus; places: SaveStatus; unsent: number; online: boolean };

const plural = (count: number) => (count === 1 ? '1 change' : `${count} changes`);

export function syncOf(input: SyncInput): { state: SyncState; label: string } {
  const statuses = [input.nodes, input.places];
  const busy = input.unsent > 0 || statuses.some((status) => status !== SaveStatus.Saved);

  if (!busy) {
    return { state: SyncState.Saved, label: 'Saved' };
  }
  if (!input.online) {
    return { state: SyncState.Offline, label: `Offline — ${plural(Math.max(input.unsent, 1))} waiting` };
  }
  if (statuses.includes(SaveStatus.Retrying)) {
    return { state: SyncState.Retrying, label: 'Retrying…' };
  }
  return { state: SyncState.Saving, label: 'Saving…' };
}
