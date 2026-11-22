import { describe, expect, it } from 'vitest';
import { ServerState, ToView } from '../messages';
import { Step } from './restart-watch';
import { shownFor } from './server-watch';

describe('shownFor', () => {
  it('a restart shows the restarting state', () => {
    expect(shownFor(Step.Restarting, undefined, '')).toEqual([{ kind: ToView.Server, state: ServerState.Restarting, reason: undefined, info: undefined }]);
  });

  it('the end of a restart reloads the page', () => {
    expect(shownFor(Step.Reload, undefined, '').at(-1)).toEqual({ kind: ToView.Reload });
  });

  it('nothing happening shows nothing', () => {
    expect(shownFor(Step.None, undefined, '')).toEqual([]);
  });

  it('giving up shows the server as stopped with the last error', () => {
    expect(shownFor(Step.GiveUp, undefined, 'boom')[0]).toMatchObject({ state: ServerState.Stopped, reason: 'boom' });
  });
});
