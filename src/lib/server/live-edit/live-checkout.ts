import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, cpSync, existsSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';

export const LIVE_BRANCH = 'feega/live';

export const LIVE_DIR_ENV = 'FEEGA_LIVE_DIR';

const liveHome = () => process.env[LIVE_DIR_ENV] ?? join(homedir(), '.feega', 'live');
const DEPENDENCIES = 'node_modules';
const ENV_FILE = /^\.env(\..+)?$/;
const ID_LENGTH = 8;

const git = (cwd: string, args: string[]) => {
  const done = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  return done.status === 0 ? done.stdout.trim() : null;
};

const checkoutDir = (home: string, top: string) => join(home, `${basename(top)}-${createHash('sha256').update(top).digest('hex').slice(0, ID_LENGTH)}`);

function linkEnv(from: string, to: string) {
  for (const name of readdirSync(from).filter((f) => ENV_FILE.test(f))) {
    if (!existsSync(join(to, name))) {
      symlinkSync(join(from, name), join(to, name));
    }
  }
}

function ownDependencies(from: string, to: string) {
  if (existsSync(join(from, DEPENDENCIES)) && !existsSync(join(to, DEPENDENCIES))) {
    cpSync(join(from, DEPENDENCIES), join(to, DEPENDENCIES), { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
  }
}

function furnish(from: string, to: string) {
  ownDependencies(from, to);
  linkEnv(from, to);
}

function added(top: string, at: string): boolean {
  mkdirSync(dirname(at), { recursive: true });
  const branchExists = git(top, ['rev-parse', '--verify', '--quiet', `refs/heads/${LIVE_BRANCH}`]) !== null;
  const args = branchExists ? ['worktree', 'add', '-q', at, LIVE_BRANCH] : ['worktree', 'add', '-q', '-b', LIVE_BRANCH, at, 'HEAD'];
  return git(top, args) !== null;
}

export function liveCheckoutOf(folder: string, home = liveHome()): string {
  const top = git(folder, ['rev-parse', '--show-toplevel']);
  if (!top) {
    return folder;
  }

  const at = checkoutDir(home, top);
  if (!existsSync(join(at, '.git')) && !added(top, at)) {
    return folder;
  }

  const app = relative(top, folder);
  furnish(top, at);
  if (app) {
    furnish(folder, join(at, app));
  }
  return join(at, app);
}
