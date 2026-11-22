import { safeStorage, shell } from 'electron';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Account } from '../../../inspect/src/host/account';
import { SignInClient, SignInEnd, signIn } from '../../../inspect/src/host/sign-in';

export function accountStore(userData: string) {
  const path = join(userData, 'account.bin');
  let signing: AbortController | null = null;

  const read = (): Account | null => {
    try {
      return JSON.parse(safeStorage.decryptString(readFileSync(path)));
    } catch {
      return null;
    }
  };

  const write = (account: Account) => {
    if (!safeStorage.isEncryptionAvailable()) {
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, safeStorage.encryptString(JSON.stringify(account)), { mode: 0o600 });
  };

  let held = read();
  let waiting = false;

  return {
    email: () => held?.user.email ?? null,
    waiting: () => waiting,
    cancel: () => signing?.abort(),
    start: async (changed: () => void): Promise<boolean> => {
      signing?.abort();
      const mine = (signing = new AbortController());
      waiting = true;
      changed();
      const outcome = await signIn({ client: SignInClient.Desktop, openBrowser: (url) => shell.openExternal(url), signal: mine.signal });
      if (signing === mine) {
        waiting = false;
      }
      if (outcome.end !== SignInEnd.Done) {
        return false;
      }
      held = outcome.account;
      write(held);
      return true;
    },
    clear: () => {
      signing?.abort();
      held = null;
      rmSync(path, { force: true });
    }
  };
}
