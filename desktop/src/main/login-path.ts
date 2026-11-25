import { execFile } from 'node:child_process';

const SHELL_TIMEOUT_MS = 5000;
const SEPARATOR = ':';
const PATH_LIST = /^[^\s:][^\s]*$/;
const UNIX_PLATFORMS = new Set(['darwin', 'linux']);

export type RunShell = (shell: string, args: string[]) => Promise<string>;

export type LoginPathPorts = { platform: string; env: NodeJS.ProcessEnv; run: RunShell };

export const pathFromShellOutput = (output: string): string | null => {
  const last = output.trim().split('\n').at(-1)?.trim() ?? '';
  return PATH_LIST.test(last) && last.includes('/') ? last : null;
};

export const mergePaths = (first: string, second: string): string => [...new Set([...first.split(SEPARATOR), ...second.split(SEPARATOR)])].filter(Boolean).join(SEPARATOR);

export const runShell: RunShell = (shell, args) =>
  new Promise((resolve, reject) => {
    execFile(shell, args, { timeout: SHELL_TIMEOUT_MS }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
  });

export async function readLoginPath({ platform, env, run }: LoginPathPorts): Promise<void> {
  const shell = env.SHELL;
  if (!UNIX_PLATFORMS.has(platform) || !shell) {
    return;
  }

  const output = await run(shell, ['-ilc', 'echo $PATH']).catch(() => '');
  const login = pathFromShellOutput(output);
  if (login) {
    env.PATH = mergePaths(login, env.PATH ?? '');
  }
}
