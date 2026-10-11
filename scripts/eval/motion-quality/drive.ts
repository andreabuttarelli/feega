import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type AgentState = { running: boolean; messages: readonly { role?: string }[] };

const idle = (state: AgentState) => !state.running && state.messages.at(-1)?.role === 'assistant';

export function turnSettled(before: AgentState | null, now: AgentState): boolean {
  return Boolean(before && idle(before) && idle(now) && before.messages.length === now.messages.length);
}

export type TestAccount = { loginUrl: string; email: string; password: string };

const ACCOUNT_ASK = /account|login|log in|credenzial|password|accesso/i;

export const asksUser = (text: string) => text.trim().endsWith('?') || ACCOUNT_ASK.test(text);

export enum AccountGiven {
  No = 'no',
  Yes = 'yes'
}

export const serverEnv = (baseUrl: string, chromiumPath: string) => ({ PUBLIC_APP_URL: baseUrl, BROWSERLESS_API_KEY: '', CHROMIUM_PATH: chromiumPath });

export function replyTo(question: string, account: TestAccount | null, given = AccountGiven.No): string {
  if (!ACCOUNT_ASK.test(question)) {
    return 'Sì, vai pure. Decidi tu il resto.';
  }
  if (!account || given === AccountGiven.Yes) {
    return 'Salta: non ho un account di prova, usa il sito pubblico.';
  }
  return `Account di test usa-e-getta: login ${account.loginUrl}, email ${account.email}, password ${account.password}. Usalo per vedere l'app (editor, canvas, chat).`;
}

export enum CutAnswer {
  Apply = 'cut-apply',
  Ship = 'cut-ship'
}

export const cutAnswerFor = (answered: number) => (answered === 0 ? CutAnswer.Apply : CutAnswer.Ship);

export class Teardowns {
  private pending = new Map<string, () => Promise<void>>();

  add(key: string, run: () => Promise<void>): () => Promise<void> {
    this.pending.set(key, run);
    return () => this.runOne(key);
  }

  async runAll(): Promise<string[]> {
    const failed: string[] = [];
    for (const key of [...this.pending.keys()]) {
      await this.runOne(key).catch(() => failed.push(key));
    }
    return failed;
  }

  private async runOne(key: string): Promise<void> {
    const run = this.pending.get(key);
    this.pending.delete(key);
    await run?.();
  }
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
