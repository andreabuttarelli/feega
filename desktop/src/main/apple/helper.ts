import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { BAD_OUTPUT, parseAvailability, parseHelperOutput, type HelperResult } from './helper-output';

const HELPER_DIR = 'FeegaAppleSignIn.app/Contents/MacOS';
const HELPER_NAME = 'feega-apple-signin';
const CHECK_TIMEOUT_MS = 5_000;
const SIGN_IN_TIMEOUT_MS = 5 * 60_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

export type AppleHelper = {
  available: () => Promise<boolean>;
  signIn: (hashedNonce: string, signal: AbortSignal) => Promise<HelperResult>;
};

const run = (path: string, args: string[], timeout: number, signal?: AbortSignal): Promise<string> =>
  new Promise((resolve) => {
    execFile(path, args, { timeout, maxBuffer: MAX_OUTPUT_BYTES, signal }, (_error, stdout) => resolve(stdout));
  });

export const helperPath = (resources: string, isPackaged: boolean, devRoot: string): string =>
  isPackaged ? join(resources, 'native', HELPER_DIR, HELPER_NAME) : join(devRoot, 'build', 'native', HELPER_DIR, HELPER_NAME);

export const appleHelper = (path: string): AppleHelper => ({
  available: async () => parseAvailability(await run(path, ['check'], CHECK_TIMEOUT_MS)),
  signIn: async (hashedNonce, signal) => {
    const stdout = await run(path, ['sign-in', '--nonce', hashedNonce], SIGN_IN_TIMEOUT_MS, signal);
    if (signal.aborted) {
      return { ok: false, error: { code: 'cancelled', message: 'Cancelled' } };
    }

    return stdout ? parseHelperOutput(stdout) : { ok: false, error: { code: BAD_OUTPUT, message: 'helper exited without output' } };
  }
});
