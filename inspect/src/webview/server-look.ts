import { ServerState } from '../messages';

export type ServerLook = { dot: 'grey' | 'amber' | 'green' | 'red'; label: string; action: string | null };

const LOOKS: Record<ServerState, ServerLook> = {
  [ServerState.Detecting]: { dot: 'grey', label: 'Looking for a dev server', action: null },
  [ServerState.Starting]: { dot: 'amber', label: 'Starting the dev server', action: null },
  [ServerState.Running]: { dot: 'green', label: 'Dev server running', action: 'Restart' },
  [ServerState.Reloading]: { dot: 'amber', label: 'Reloading', action: null },
  [ServerState.Stopped]: { dot: 'red', label: 'Dev server stopped', action: 'Start dev server' }
};

export const serverLook = (state: ServerState): ServerLook => LOOKS[state];
