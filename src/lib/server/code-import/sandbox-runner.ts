import { Sandbox } from '@vercel/sandbox';
import type { FarmAccess } from '$lib/server/motion/vercel-farm';
import { cloneUrl, namesIn, type RepoRef } from './repo';
import { ORIGIN_PROXY } from './origin-proxy';
import { NodeLine, planFile, PlanRefusal, runPlan, textsWanted, type Planned, type RepoFacts, type RunPlan } from './run-plan';

export type RunningApp = { url: string; names: string[]; sha: string | null; stop: () => Promise<void> };

export enum RunFailure {
  Clone = 'clone_failed',
  Install = 'install_failed',
  NoDevServer = 'no_dev_server'
}

export type RunOutcome = { ok: true; app: RunningApp } | { ok: false; failure: RunFailure | PlanRefusal; detail: string; apps?: string[] };

export type RepoRunner = (repo: RepoRef, archive: Uint8Array | null, app: string | null) => Promise<RunOutcome>;

export type RunLimits = { wallMs: number; installMs: number; readyMs: number; vcpus: number; port: number; devPort: number; files: number };

export const RUN_LIMITS: RunLimits = { wallMs: 6 * 60_000, installMs: 4 * 60_000, readyMs: 90_000, vcpus: 4, port: 4173, devPort: 4174, files: 4_000 };

const POLL_MS = 2_000;
const MS_PER_HOUR = 3_600_000;
const VCPU_HOUR_USD = 0.128;
const GB_HOUR_USD = 0.0106;
const GB_PER_VCPU = 2;

export const sandboxUsd = (ms: number, vcpus: number = RUN_LIMITS.vcpus) => (ms / MS_PER_HOUR) * vcpus * (VCPU_HOUR_USD + GB_PER_VCPU * GB_HOUR_USD);
const TAIL = 400;
const SHA = /^[0-9a-f]{40}$/;
const PROXY_FILE = '/tmp/feega-origin-proxy.cjs';
const ALL_INTERFACES = '0.0.0.0';
const LISTED_FILES = 50_000;

const IMAGES: Record<NodeLine, string> = {
  [NodeLine.Node22]: 'vercel/sandbox/node:22',
  [NodeLine.Node24]: 'vercel/sandbox/universal',
  [NodeLine.Node26]: 'vercel/sandbox/node:26'
};
const FIRST_LINE = NodeLine.Node24;

const LIST = `find . \\( -name node_modules -o -name .git \\) -prune -o -type f -print | sed 's|^\\./||' | head -n ${LISTED_FILES}`;
const READ_SCRIPT = `const f=require("fs");const o={};for(const p of process.argv.slice(1)){try{o[p]=f.readFileSync(p,"utf8")}catch{}}process.stdout.write(JSON.stringify(o))`;

export const quoted = (arg: string) => `'${arg.replaceAll("'", `'\\''`)}'`;
const line = (argv: string[]) => argv.map(quoted).join(' ');

const NAMES = `find . -path ./node_modules -prune -o -type f \\( -name '*.tsx' -o -name '*.jsx' -o -name '*.js' \\) -print | grep -v -E '/(node_modules|\\.svelte-kit|\\.next|dist|build)/' | head -n ${RUN_LIMITS.files} | xargs cat 2>/dev/null`;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const failed = (failure: RunFailure | PlanRefusal, detail: string, apps?: string[]): RunOutcome => ({ ok: false, failure, detail: detail.slice(-TAIL), ...(apps?.length ? { apps } : {}) });

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Box = { sandbox: Sandbox; dir: string };

const within = (box: Box, sub: string): Box => (sub ? { ...box, dir: `${box.dir}/${sub}` } : box);

async function shell({ sandbox, dir }: Box, script: string, env: Record<string, string> = {}) {
  const done = await sandbox.runCommand({ cmd: 'bash', args: ['-lc', script], cwd: dir, env });
  return { ok: done.exitCode === 0, out: await done.stdout(), err: await done.stderr() };
}

async function ready(box: Box, ports: number[], limits: RunLimits): Promise<number | null> {
  const until = Date.now() + limits.readyMs;
  while (Date.now() < until) {
    for (const port of new Set(ports)) {
      const probe = await shell(box, `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${port}/`);
      if (probe.ok && /^[23]/.test(probe.out.trim())) {
        return port;
      }
    }
    await pause(POLL_MS);
  }
  return null;
}

async function factsIn(box: Box): Promise<RepoFacts> {
  const files = (await shell(box, LIST)).out.split('\n').map((f) => f.trim()).filter(planFile);
  const wanted = textsWanted(files);
  const texts = wanted.length ? (JSON.parse((await shell(box, `node -e ${quoted(READ_SCRIPT)} ${line(wanted)}`)).out || '{}') as Record<string, string>) : {};
  return { files, texts };
}

async function started(box: Box, plan: RunPlan, limits: RunLimits): Promise<RunOutcome> {
  const install = await Promise.race([shell(within(box, plan.installDir), line(plan.install), plan.env), pause(limits.installMs).then(() => ({ ok: false, out: '', err: 'install timed out' }))]);
  if (!install.ok) {
    return failed(RunFailure.Install, `${install.out}${install.err}`);
  }

  await box.sandbox.runCommand({ cmd: 'bash', args: ['-lc', `${line(plan.dev)} > /tmp/dev.log 2>&1`], cwd: within(box, plan.appDir).dir, detached: true, env: plan.env });
  const port = await ready(box, [plan.port, plan.defaultPort], limits);
  if (port === null) {
    return failed(RunFailure.NoDevServer, (await shell(box, 'tail -c 400 /tmp/dev.log')).out);
  }

  await box.sandbox.writeFiles([{ path: PROXY_FILE, content: ORIGIN_PROXY }]);
  await box.sandbox.runCommand({ cmd: 'node', args: [PROXY_FILE, String(limits.port), String(port)], detached: true });
  if ((await ready(box, [limits.port], limits)) === null) {
    return failed(RunFailure.NoDevServer, 'the origin proxy did not start');
  }

  const names = namesIn((await shell(box, NAMES)).out);
  const head = (await shell(box, 'git rev-parse HEAD')).out.trim();
  return { ok: true, app: { url: box.sandbox.domain(limits.port), names, sha: SHA.test(head) ? head : null, stop: () => box.sandbox.stop().then(() => undefined) } };
}

const ARCHIVE_FILE = '/tmp/feega-repo.tgz';

const cloned = (repo: RepoRef) => ({ source: { type: 'git' as const, url: cloneUrl(repo), depth: 1, ...(repo.ref ? { revision: repo.ref } : {}) } });

async function unpacked(box: Box, archive: Uint8Array): Promise<RunOutcome | null> {
  await box.sandbox.writeFiles([{ path: ARCHIVE_FILE, content: archive }]);
  const done = await shell({ ...box, dir: '/' }, `mkdir -p ${box.dir} && tar xzf ${ARCHIVE_FILE} -C ${box.dir} --strip-components=1 && rm ${ARCHIVE_FILE}`);
  return done.ok ? null : failed(RunFailure.Clone, done.err);
}

type Boot = { access: FarmAccess; limits: RunLimits; repo: RepoRef; archive: Uint8Array | null };

async function booted(boot: Boot, node: NodeLine): Promise<Box | RunOutcome> {
  const { access, limits, repo, archive } = boot;
  const sandbox = await Sandbox.create({
    ...access,
    ...(archive ? {} : cloned(repo)),
    image: IMAGES[node],
    ports: [limits.port],
    timeout: limits.wallMs,
    resources: { vcpus: limits.vcpus },
    env: {}
  }).catch((e: unknown) => e as Error);
  if (sandbox instanceof Error) {
    return failed(RunFailure.Clone, sandbox.message);
  }

  const box = { sandbox, dir: `${sandbox.cwd}/${repo.repo}` };
  const unpack = archive ? await unpacked(box, archive).catch((e: unknown) => failed(RunFailure.Clone, reason(e))) : null;
  if (unpack) {
    await sandbox.stop().catch(() => undefined);
    return unpack;
  }
  return box;
}

const planOf = (box: Box, app: string | null, limits: RunLimits): Promise<Planned> => factsIn(box).then((facts) => runPlan(facts, app, { host: ALL_INTERFACES, port: limits.devPort }));

export function sandboxRunner(access: FarmAccess, limits: RunLimits = RUN_LIMITS): RepoRunner {
  return async (repo, archive, app) => {
    const boot = { access, limits, repo, archive };
    const first = await booted(boot, FIRST_LINE);
    if (!('sandbox' in first)) {
      return first;
    }

    const plan = await planOf(first, app, limits).catch((e: unknown) => failed(RunFailure.NoDevServer, reason(e)));
    if (!('install' in plan)) {
      await first.sandbox.stop().catch(() => undefined);
      return 'refusal' in plan ? failed(plan.refusal, plan.reason, plan.apps) : plan;
    }

    if (plan.node !== FIRST_LINE) {
      await first.sandbox.stop().catch(() => undefined);
    }
    const box = plan.node === FIRST_LINE ? first : await booted(boot, plan.node);
    if (!('sandbox' in box)) {
      return box;
    }

    const outcome = await started(box, plan, limits).catch((e: unknown) => failed(RunFailure.NoDevServer, reason(e)));
    if (!outcome.ok) {
      await box.sandbox.stop().catch(() => undefined);
    }
    return outcome;
  };
}
