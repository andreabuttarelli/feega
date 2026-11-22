import { execFile, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { dirname, join } from 'node:path';
import { Step, StepKind, type SwapPlan } from './swap-plan';

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 20_000;
const HTTP_OK = 200;
const HTTP_REDIRECT_MIN = 300;
const HTTP_REDIRECT_MAX = 399;
const IDENTIFIER = /^Identifier=(.+)$/m;

const run = (command: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => (error ? reject(new Error(`${command} failed: ${stderr || error.message}`)) : resolve(`${stdout}${stderr}`)));
  });

const request = (url: string, redirects = 0): Promise<import('node:http').IncomingMessage> =>
  new Promise((resolve, reject) => {
    const get = url.startsWith('https:') ? httpsGet : httpGet;
    const req = get(url, { timeout: REQUEST_TIMEOUT_MS, headers: { 'user-agent': 'feega-desktop-updater' } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= HTTP_REDIRECT_MIN && status <= HTTP_REDIRECT_MAX && res.headers.location) {
        res.resume();
        if (redirects >= MAX_REDIRECTS) {
          reject(new Error('too many redirects'));
          return;
        }
        resolve(request(new URL(res.headers.location, url).toString(), redirects + 1));
        return;
      }
      if (status !== HTTP_OK) {
        res.resume();
        reject(new Error(`${url} answered ${status}`));
        return;
      }
      resolve(res);
    });
    req.on('timeout', () => req.destroy(new Error('request timed out')));
    req.on('error', reject);
  });

export const fetchText = async (url: string): Promise<string> => {
  const res = await request(url);
  const chunks: Buffer[] = [];
  for await (const chunk of res) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
};

export const downloadTo = async (url: string, dest: string): Promise<void> => {
  const res = await request(url);
  mkdirSync(dirname(dest), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(dest);
    res.pipe(out);
    out.on('finish', () => resolve());
    out.on('error', reject);
    res.on('error', reject);
  });
};

export const extractZip = (zip: string, dir: string): Promise<string> => {
  mkdirSync(dir, { recursive: true });
  return run('ditto', ['-x', '-k', zip, dir]);
};

export const bundleIn = (dir: string): string | null => {
  const app = readdirSync(dir).find((name) => name.endsWith('.app'));
  return app ? join(dir, app) : null;
};

export const signatureIdentifier = async (bundle: string): Promise<string | null> => {
  await run('codesign', ['--verify', '--deep', '--strict', bundle]);
  return IDENTIFIER.exec(await run('codesign', ['-dv', '--verbose=2', bundle]))?.[1] ?? null;
};

const relaunch = (path: string, pid: number) => {
  const script = 'while kill -0 "$0" 2>/dev/null; do sleep 0.2; done; open -n "$1"';
  spawn('/bin/sh', ['-c', script, String(pid), path], { detached: true, stdio: 'ignore' }).unref();
};

const perform = async (step: Step): Promise<void> => {
  if (step.kind === StepKind.Move) {
    mkdirSync(dirname(step.to), { recursive: true });
    rmSync(step.to, { recursive: true, force: true });
    await run('mv', [step.from, step.to]);
    return;
  }
  if (step.kind === StepKind.Copy) {
    await run('ditto', [step.from, step.to]);
    return;
  }
  if (step.kind === StepKind.Remove) {
    rmSync(step.path, { recursive: true, force: true });
    return;
  }
  relaunch(step.path, step.pid);
};

export const runPlan = async ({ steps, rollback }: SwapPlan): Promise<void> => {
  let done = 0;
  try {
    for (const step of steps) {
      await perform(step);
      done++;
    }
  } catch (error) {
    for (const step of done > 0 ? rollback : []) {
      await perform(step).catch(() => undefined);
    }
    throw error;
  }
};
