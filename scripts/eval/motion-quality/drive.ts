import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type AgentState = { running: boolean; messages: readonly { role?: string }[] };

const idle = (state: AgentState) => !state.running && state.messages.at(-1)?.role === 'assistant';

export function turnSettled(before: AgentState | null, now: AgentState): boolean {
  return Boolean(before && idle(before) && idle(now) && before.messages.length === now.messages.length);
}

export const pidAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export function claimPort(port: number, dir: string, alive: (pid: number) => boolean = pidAlive): () => void {
  const lock = join(dir, `feega-eval-motion-${port}.lock`);
  const holder = existsSync(lock) ? Number(readFileSync(lock, 'utf8')) : null;
  if (holder && alive(holder)) {
    throw new Error(`another motion eval (pid ${holder}) runs on port ${port}: wait for it or pass another --port`);
  }
  writeFileSync(lock, String(process.pid));
  return () => rmSync(lock, { force: true });
}
