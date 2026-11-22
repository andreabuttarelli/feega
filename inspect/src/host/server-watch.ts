import { listening, type Running } from './dev-server';
import { ServerState, ToView, type ServerInfo, type ViewMessage } from '../messages';
import { RestartWatch, Signal, Step } from './restart-watch';

const WATCH_MS = 250;

export type Watching = { started: Running; restarts: RestartWatch; current: () => boolean; act: (step: Step) => unknown };

export async function watchServer({ started, restarts, current, act }: Watching) {
  const port = Number(new URL(started.upstream).port);
  while (current()) {
    const signal = (await listening(port)) ? Signal.Alive : Signal.Lost;
    if (current()) {
      act(restarts.feed(signal, Date.now()));
    }
    await new Promise((resolve) => setTimeout(resolve, WATCH_MS));
  }
}

export function shownFor(step: Step, info: ServerInfo | undefined, lastError: string): ViewMessage[] {
  const state = (state: ServerState, reason?: string): ViewMessage => ({ kind: ToView.Server, state, reason, info });
  const shown: Record<Step, ViewMessage[]> = {
    [Step.None]: [],
    [Step.Restarting]: [state(ServerState.Restarting)],
    [Step.Respawn]: [state(ServerState.Restarting)],
    [Step.Reload]: [state(ServerState.Running), { kind: ToView.Reload }],
    [Step.GiveUp]: [state(ServerState.Stopped, lastError || 'the dev server keeps exiting')]
  };
  return shown[step];
}
