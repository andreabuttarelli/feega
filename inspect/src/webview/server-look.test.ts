import { describe, expect, it } from 'vitest';
import { ServerAction, ServerState } from '../messages';
import { actionsOf } from './server-look';

describe('actionsOf', () => {
  it('a running server we started can restart, stop, reload, clear cache', () => {
    expect(actionsOf(ServerState.Running, false)).toEqual([ServerAction.ReloadPage, ServerAction.Restart, ServerAction.ClearCache, ServerAction.Stop, ServerAction.ShowLogs, ServerAction.ChangeCommand, ServerAction.ChooseApp]);
  });

  it('an attached server is never stopped by us and offers to restart under Feega', () => {
    const actions = actionsOf(ServerState.Running, true);

    expect(actions).toContain(ServerAction.RestartUnderFeega);
    expect(actions).not.toContain(ServerAction.Stop);
  });

  it('a stopped server can start', () => {
    expect(actionsOf(ServerState.Stopped, false)[0]).toBe(ServerAction.Start);
  });

  it('while starting only the logs', () => {
    expect(actionsOf(ServerState.Starting, false)).toEqual([ServerAction.ShowLogs]);
  });

  it('an install can be cancelled', () => {
    expect(actionsOf(ServerState.Installing, false)).toEqual([ServerAction.Cancel, ServerAction.ShowLogs]);
  });

  it('a stopped server can switch app', () => {
    expect(actionsOf(ServerState.Stopped, false)).toContain(ServerAction.ChooseApp);
  });
});
