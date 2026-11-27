import { spawn } from 'node:child_process';
import { GIT_MISSING, type GitRun } from './git-panel';

const NETWORK_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const NO_PROMPT_ENV = { GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
const NOT_FOUND = 'ENOENT';
const FAILED = 1;

export const nodeGit =
  (cwd: string, env: NodeJS.ProcessEnv = process.env): GitRun =>
  (args) =>
    new Promise((resolve) => {
      const child = spawn('git', args, { cwd, env: { ...env, ...NO_PROMPT_ENV }, stdio: ['ignore', 'pipe', 'pipe'], timeout: NETWORK_TIMEOUT_MS });
      let out = '';
      let err = '';
      child.stdout.on('data', (chunk) => (out = (out + chunk).slice(0, MAX_OUTPUT_BYTES)));
      child.stderr.on('data', (chunk) => (err = (err + chunk).slice(0, MAX_OUTPUT_BYTES)));
      child.once('error', (error: NodeJS.ErrnoException) => resolve({ code: error.code === NOT_FOUND ? GIT_MISSING : FAILED, out, err: err || error.message }));
      child.once('close', (code) => resolve({ code: code ?? FAILED, out, err }));
    });
