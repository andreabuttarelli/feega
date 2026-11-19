import { ServerAction, ServerState } from '../messages';

export type ServerLook = { dot: 'grey' | 'amber' | 'green' | 'red'; label: string; action: string | null };

const LOOKS: Record<ServerState, ServerLook> = {
  [ServerState.Detecting]: { dot: 'grey', label: 'Looking for a dev server', action: null },
  [ServerState.Starting]: { dot: 'amber', label: 'Starting the dev server', action: null },
  [ServerState.Running]: { dot: 'green', label: 'Dev server running', action: 'Restart' },
  [ServerState.Reloading]: { dot: 'amber', label: 'Reloading', action: null },
  [ServerState.Stopped]: { dot: 'red', label: 'Dev server stopped', action: 'Start dev server' }
};

export const serverLook = (state: ServerState): ServerLook => LOOKS[state];

const LOGS = [ServerAction.ShowLogs];
const OWN = [ServerAction.ShowLogs, ServerAction.ChangeCommand];

const ACTIONS: Record<ServerState, { own: ServerAction[]; attached: ServerAction[] }> = {
  [ServerState.Detecting]: { own: LOGS, attached: LOGS },
  [ServerState.Starting]: { own: LOGS, attached: LOGS },
  [ServerState.Reloading]: { own: LOGS, attached: LOGS },
  [ServerState.Running]: {
    own: [ServerAction.ReloadPage, ServerAction.Restart, ServerAction.ClearCache, ServerAction.Stop, ...OWN],
    attached: [ServerAction.ReloadPage, ServerAction.RestartUnderFeega, ...OWN]
  },
  [ServerState.Stopped]: { own: [ServerAction.Start, ServerAction.ClearCache, ...OWN], attached: [ServerAction.Start, ...OWN] }
};

export const actionsOf = (state: ServerState, attached: boolean): ServerAction[] => ACTIONS[state][attached ? 'attached' : 'own'];

export const ACTION_LABEL: Record<ServerAction, string> = {
  [ServerAction.Start]: 'Start',
  [ServerAction.Restart]: 'Restart',
  [ServerAction.Stop]: 'Stop',
  [ServerAction.ReloadPage]: 'Reload page',
  [ServerAction.ClearCache]: 'Clear cache & restart',
  [ServerAction.ShowLogs]: 'Show logs',
  [ServerAction.ChangeCommand]: 'Change command…',
  [ServerAction.RestartUnderFeega]: 'Restart under Feega'
};
