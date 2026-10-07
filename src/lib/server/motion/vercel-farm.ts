import { Sandbox } from '@vercel/sandbox';
import { HYPERFRAMES_VERSION } from '$lib/motion/hyperframes/compose';
import { FARM_RUNTIME_DIR, type FarmWorker, type LiveWorker, type RenderFarm, type WorkerUsage, type WorkerSpec } from './render-farm';

export type FarmAccess = { token?: string; teamId?: string; projectId?: string };

const BASE_SETUP_REVISION = 2;
export const FARM_BASE = `feega-motion-render-${HYPERFRAMES_VERSION.replaceAll('.', '-')}-r${BASE_SETUP_REVISION}`;

const BASE_VCPUS = 8;
const RUNNING = 'running';
const BASE_SETUP_TIMEOUT_MS = 10 * 60_000;

const CHROME_LIBS = 'libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64';

const BASE_SETUP = [
  `sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg zip fonts-noto-color-emoji ${CHROME_LIBS}`,
  `mkdir -p ${FARM_RUNTIME_DIR} && cd ${FARM_RUNTIME_DIR} && npm init -y && npm i --no-audit --no-fund hyperframes@${HYPERFRAMES_VERSION} @hyperframes/producer@${HYPERFRAMES_VERSION}`,
  `cd ${FARM_RUNTIME_DIR} && npx hyperframes browser ensure`
];

export const workerPrefix = (deployment: string) => `feega-motion-w-${deployment}-`;

export function farmAccess(source: Record<string, string | undefined>): FarmAccess | null {
  const token = source.SANDBOX_VERCEL_TOKEN || source.VERCEL_TOKEN;
  if (token && source.VERCEL_TEAM_ID && source.VERCEL_PROJECT_ID) {
    return { token, teamId: source.VERCEL_TEAM_ID, projectId: source.VERCEL_PROJECT_ID };
  }
  return source.VERCEL === '1' ? {} : null;
}

async function setUp(sandbox: Sandbox): Promise<void> {
  for (const step of BASE_SETUP) {
    const done = await sandbox.runCommand('bash', ['-lc', step]);
    if (done.exitCode !== 0) {
      throw new Error(`render base setup failed: ${(await done.stderr()).slice(-400)}`);
    }
  }
}

async function prepareBase(access: FarmAccess): Promise<void> {
  const base = await Sandbox.getOrCreate({ ...access, name: FARM_BASE, persistent: true, resources: { vcpus: BASE_VCPUS }, timeout: BASE_SETUP_TIMEOUT_MS, onCreate: setUp });
  if (base.status === RUNNING) {
    await base.stop();
  }
}

function workerOf(sandbox: Sandbox): FarmWorker {
  return {
    name: sandbox.name,
    write: (files) => sandbox.writeFiles(files),
    run: async (cmd, args) => {
      const done = await sandbox.runCommand(cmd, args);
      return { exitCode: done.exitCode ?? 1, output: (await done.stdout()) + (await done.stderr()) };
    },
    spawn: async (cmd, args) => {
      await sandbox.runCommand({ cmd, args, detached: true });
    },
    read: (path) => sandbox.readFileToBuffer({ path }),
    stop: async () => {
      await sandbox.stop();
    }
  };
}

export function vercelFarm(access: FarmAccess, deployment = 'local'): RenderFarm {
  const prefix = workerPrefix(deployment);
  let base: Promise<void> | null = null;
  const ready = () => {
    base ??= prepareBase(access).catch((e) => {
      base = null;
      throw e;
    });
    return base;
  };

  return {
    open: async (spec: WorkerSpec) => {
      await ready();
      const sandbox = await Sandbox.fork({
        ...access,
        sourceSandbox: FARM_BASE,
        name: `${prefix}${crypto.randomUUID()}`,
        resources: { vcpus: spec.vcpus },
        timeout: spec.timeoutMs,
        networkPolicy: { allow: spec.allowHosts },
        persistent: false,
        env: {}
      });
      return workerOf(sandbox);
    },
    attach: async (name: string) => {
      const sandbox = await Sandbox.get({ ...access, name }).catch(() => null);
      return sandbox?.status === RUNNING ? workerOf(sandbox) : null;
    },
    running: async (): Promise<LiveWorker[]> => {
      const listed = await (await Sandbox.list({ ...access, namePrefix: prefix })).toArray();
      return listed.filter((s) => s.status === RUNNING).map((s) => ({ name: s.name, createdAt: s.createdAt }));
    },
    usage: async (name: string): Promise<WorkerUsage | null> => {
      const sandbox = await Sandbox.get({ ...access, name }).catch(() => null);
      if (!sandbox) {
        return null;
      }
      const end = sandbox.status === RUNNING ? Date.now() : (sandbox.statusUpdatedAt?.getTime() ?? Date.now());
      return { cpuMs: sandbox.activeCpuUsageMs ?? 0, memoryMb: sandbox.memory ?? 0, wallMs: end - sandbox.createdAt.getTime() };
    }
  };
}
