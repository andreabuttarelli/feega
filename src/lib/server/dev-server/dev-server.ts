import { devCommand, type Command } from './dev-command';
import { DevState, type DevStatus } from './supervisor';

export enum DevSource {
  Detected = 'detected',
  Spawned = 'spawned',
  None = 'none'
}

export type DevServerStatus = DevStatus & { source: DevSource; folder: string };

type Repo = { packageJson: string; lockfiles: readonly string[]; configured?: string };

type Supervisor = { start: (command: Command, cwd: string) => void; stop: () => void; status: () => DevStatus };

type Deps = { folder: string; repo: () => Repo; running: () => Promise<string | null>; supervisor: Supervisor };

const NO_DEV_SCRIPT = 'No dev script in package.json: add one, or set FEEGA_DEV_COMMAND.';

export function devServer(deps: Deps) {
  const supervised = (): DevServerStatus => {
    const status = deps.supervisor.status();
    const source = status.state === DevState.Stopped ? DevSource.None : DevSource.Spawned;
    return { ...status, source, folder: deps.folder };
  };

  const status = async (): Promise<DevServerStatus> => {
    const own = supervised();
    if (own.source === DevSource.Spawned) {
      return own;
    }

    const url = await deps.running();
    return url ? { state: DevState.Running, url, logs: [], source: DevSource.Detected, folder: deps.folder } : own;
  };

  return {
    status,
    async start(): Promise<DevServerStatus> {
      const current = await status();
      if (current.state === DevState.Running || current.state === DevState.Starting) {
        return current;
      }

      const command = devCommand(deps.repo());
      if (!command) {
        throw new Error(NO_DEV_SCRIPT);
      }

      deps.supervisor.start(command, deps.folder);
      return supervised();
    },
    stop(): DevServerStatus {
      deps.supervisor.stop();
      return supervised();
    }
  };
}

export type DevServer = ReturnType<typeof devServer>;
