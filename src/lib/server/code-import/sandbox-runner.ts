import { Sandbox } from '@vercel/sandbox';
import type { FarmAccess } from '$lib/server/motion/vercel-farm';
import { cloneUrl, DEV_ARGS, devServerOf, managerOf, namesIn, PackageManager, type RepoRef } from './repo';
import { ORIGIN_PROXY } from './origin-proxy';

export type RunningApp = { url: string; names: string[]; stop: () => Promise<void> };

export enum RunFailure {
  Clone = 'clone_failed',
  NoPackage = 'no_package',
  Install = 'install_failed',
  NoDevServer = 'no_dev_server'
}

export type RunOutcome = { ok: true; app: RunningApp } | { ok: false; failure: RunFailure; detail: string };

export type RepoRunner = (repo: RepoRef, archive: Uint8Array | null) => Promise<RunOutcome>;

export type RunLimits = { wallMs: number; installMs: number; readyMs: number; vcpus: number; port: number; devPort: number; files: number };

export const RUN_LIMITS: RunLimits = { wallMs: 6 * 60_000, installMs: 4 * 60_000, readyMs: 90_000, vcpus: 4, port: 4173, devPort: 4174, files: 4_000 };

const POLL_MS = 2_000;
const MS_PER_HOUR = 3_600_000;
const VCPU_HOUR_USD = 0.128;
const GB_HOUR_USD = 0.0106;
const GB_PER_VCPU = 2;

export const sandboxUsd = (ms: number, vcpus: number = RUN_LIMITS.vcpus) => (ms / MS_PER_HOUR) * vcpus * (VCPU_HOUR_USD + GB_PER_VCPU * GB_HOUR_USD);
const TAIL = 400;
const PROXY_FILE = '/tmp/feega-origin-proxy.cjs';

const INSTALL: Record<PackageManager, string> = {
  [PackageManager.Npm]: 'npm install --no-audit --no-fund --loglevel=error',
  [PackageManager.Pnpm]: 'pnpm install --reporter=append-only --config.strict-dep-builds=false',
  [PackageManager.Yarn]: 'npx -y yarn@1 install --non-interactive --silent',
  [PackageManager.Bun]: 'bun install'
};

const RUN: Record<PackageManager, string> = {
  [PackageManager.Npm]: 'npm run dev --',
  [PackageManager.Pnpm]: 'pnpm run dev',
  [PackageManager.Yarn]: 'npx -y yarn@1 run dev',
  [PackageManager.Bun]: 'bun run dev'
};

const NAMES = `find . -path ./node_modules -prune -o -type f \\( -name '*.tsx' -o -name '*.jsx' \\) -print | grep -v /node_modules/ | head -n ${RUN_LIMITS.files} | xargs cat 2>/dev/null`;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const failed = (failure: RunFailure, detail: string): RunOutcome => ({ ok: false, failure, detail: detail.slice(-TAIL) });

type Box = { sandbox: Sandbox; dir: string };

async function shell({ sandbox, dir }: Box, script: string, env: Record<string, string> = {}) {
  const done = await sandbox.runCommand({ cmd: 'bash', args: ['-lc', script], cwd: dir, env });
  return { ok: done.exitCode === 0, out: await done.stdout(), err: await done.stderr() };
}

async function ready(box: Box, port: number, limits: RunLimits): Promise<boolean> {
  const until = Date.now() + limits.readyMs;
  while (Date.now() < until) {
    const probe = await shell(box, `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${port}/`);
    if (probe.ok && /^[23]/.test(probe.out.trim())) {
      return true;
    }
    await pause(POLL_MS);
  }
  return false;
}

async function started(box: Box, limits: RunLimits): Promise<RunOutcome> {
  const listed = await shell(box, 'ls -1');
  const files = listed.out.split('\n').map((f) => f.trim());
  if (!files.includes('package.json')) {
    return failed(RunFailure.NoPackage, 'no package.json at the repository root');
  }

  const manager = managerOf(files);
  const install = await Promise.race([shell(box, INSTALL[manager]), pause(limits.installMs).then(() => ({ ok: false, out: '', err: 'install timed out' }))]);
  if (!install.ok) {
    return failed(RunFailure.Install, `${install.out}${install.err}`);
  }

  const pkg = JSON.parse((await shell(box, 'cat package.json')).out) as Parameters<typeof devServerOf>[0];
  const args = DEV_ARGS[devServerOf(pkg)](limits.devPort).join(' ');
  await box.sandbox.runCommand({ cmd: 'bash', args: ['-lc', `${RUN[manager]} ${args} > /tmp/dev.log 2>&1`], cwd: box.dir, detached: true, env: { PORT: String(limits.devPort), HOST: '0.0.0.0', BROWSER: 'none' } });
  if (!(await ready(box, limits.devPort, limits))) {
    return failed(RunFailure.NoDevServer, (await shell(box, 'tail -c 400 /tmp/dev.log')).out);
  }

  await box.sandbox.writeFiles([{ path: PROXY_FILE, content: ORIGIN_PROXY }]);
  await box.sandbox.runCommand({ cmd: 'node', args: [PROXY_FILE, String(limits.port), String(limits.devPort)], detached: true });
  if (!(await ready(box, limits.port, limits))) {
    return failed(RunFailure.NoDevServer, 'the origin proxy did not start');
  }

  const names = namesIn((await shell(box, NAMES)).out);
  return { ok: true, app: { url: box.sandbox.domain(limits.port), names, stop: () => box.sandbox.stop().then(() => undefined) } };
}

const ARCHIVE_FILE = '/tmp/feega-repo.tgz';

const cloned = (repo: RepoRef) => ({ source: { type: 'git' as const, url: cloneUrl(repo), depth: 1, ...(repo.ref ? { revision: repo.ref } : {}) } });

async function unpacked(box: Box, archive: Uint8Array): Promise<RunOutcome | null> {
  await box.sandbox.writeFiles([{ path: ARCHIVE_FILE, content: archive }]);
  const done = await shell({ ...box, dir: '/' }, `mkdir -p ${box.dir} && tar xzf ${ARCHIVE_FILE} -C ${box.dir} --strip-components=1 && rm ${ARCHIVE_FILE}`);
  return done.ok ? null : failed(RunFailure.Clone, done.err);
}

export function sandboxRunner(access: FarmAccess, limits: RunLimits = RUN_LIMITS): RepoRunner {
  return async (repo, archive) => {
    const sandbox = await Sandbox.create({
      ...access,
      ...(archive ? {} : cloned(repo)),
      ports: [limits.port],
      timeout: limits.wallMs,
      resources: { vcpus: limits.vcpus },
      env: {}
    }).catch((e: unknown) => e as Error);
    if (sandbox instanceof Error) {
      return failed(RunFailure.Clone, sandbox.message);
    }

    const box = { sandbox, dir: `${sandbox.cwd}/${repo.repo}` };
    const unpack = archive ? await unpacked(box, archive).catch((e: unknown) => failed(RunFailure.Clone, e instanceof Error ? e.message : String(e))) : null;
    const outcome = unpack ?? (await started(box, limits).catch((e: unknown) => failed(RunFailure.NoDevServer, e instanceof Error ? e.message : String(e))));
    if (!outcome.ok) {
      await sandbox.stop().catch(() => undefined);
    }
    return outcome;
  };
}
