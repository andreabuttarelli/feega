import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { SettingKey, type Settings } from '../settings';
import { APP_URL } from './sign-in';

export const USAGE_URL = `${APP_URL}/api/v1/telemetry`;

const FLUSH_INTERVAL_MS = 3 * 60 * 1000;
const SEND_TIMEOUT_MS = 5000;
const GLOBAL_KEY = 'feegaInspect.installId';
const INSTALL_FILE = join('.config', 'feega', 'install.json');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export enum UsageKind {
  SessionStart = 'session_start',
  Edit = 'edit',
  SessionEnd = 'session_end'
}

export enum Editor {
  VsCode = 'vscode',
  Cursor = 'cursor',
  Windsurf = 'windsurf',
  VsCodium = 'vscodium',
  Npx = 'npx'
}

export enum Device {
  Desktop = 'desktop',
  Web = 'web',
  Cli = 'cli'
}

export type Identity = { installId: string; version: string; editor: Editor; os: string; arch: string; device: Device };

export type UsageEvent = {
  event: UsageKind;
  install_id: string;
  session_id: string;
  ext_version: string;
  editor: Editor;
  os: string;
  arch: string;
  device: Device;
  edit_count?: number;
  duration_ms?: number;
};

export type Send = (events: UsageEvent[]) => Promise<unknown>;

export type UsageHost = {
  identity: () => Identity;
  enabled: () => boolean;
  send?: Send;
  now?: () => number;
  every?: (ms: number, run: () => void) => () => void;
  newId?: () => string;
};

export type InstallStore = { get: () => string | undefined; set: (id: string) => PromiseLike<unknown> | unknown };

export const globalStateInstallStore = (state: { get: (key: string) => unknown; update: (key: string, value: unknown) => PromiseLike<unknown> }): InstallStore => ({
  get: () => state.get(GLOBAL_KEY) as string | undefined,
  set: (id) => state.update(GLOBAL_KEY, id)
});

export const fileInstallStore = (path: string = join(homedir(), INSTALL_FILE)): InstallStore => ({
  get: () => {
    try {
      return JSON.parse(readFileSync(path, 'utf8')).id;
    } catch {
      return undefined;
    }
  },
  set: (id) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ id }));
  }
});

export const httpSend: Send = (events) =>
  fetch(USAGE_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events }), signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });

const intervalEvery = (ms: number, run: () => void) => {
  const timer = setInterval(run, ms);
  timer.unref();
  return () => clearInterval(timer);
};

export function installIdOf(store: InstallStore, newId: () => string = randomUUID): string {
  const stored = store.get();
  if (stored && UUID.test(stored)) {
    return stored;
  }
  const created = newId();
  try {
    Promise.resolve(store.set(created)).catch(() => undefined);
  } catch {
    return created;
  }
  return created;
}

const EDITORS_BY_APP_NAME: [string, Editor][] = [
  ['cursor', Editor.Cursor],
  ['windsurf', Editor.Windsurf],
  ['codium', Editor.VsCodium]
];

export const editorOf = (appName: string): Editor => EDITORS_BY_APP_NAME.find(([needle]) => appName.toLowerCase().includes(needle))?.[1] ?? Editor.VsCode;

const AUTOMATION_MARKERS: [string, (value: string) => boolean][] = [
  ['CI', (value) => !['', '0', 'false'].includes(value.toLowerCase())],
  ['GITHUB_ACTIONS', Boolean],
  ['BUILDKITE', Boolean],
  ['GITLAB_CI', Boolean],
  ['CIRCLECI', Boolean],
  ['JENKINS_URL', Boolean],
  ['TF_BUILD', Boolean],
  ['VITEST', Boolean],
  ['TEST_WORKER_INDEX', Boolean],
  ['NODE_ENV', (value) => value === 'test']
];

export const automated = (env: NodeJS.ProcessEnv): boolean => AUTOMATION_MARKERS.some(([name, marks]) => marks(env[name] ?? ''));

export const optedOut = (env: NodeJS.ProcessEnv): boolean => env.FEEGA_TELEMETRY === '0' || env.DO_NOT_TRACK === '1';

export const nodeUsageEnabled = (env: NodeJS.ProcessEnv, settings: Settings): boolean => !optedOut(env) && !automated(env) && settings[SettingKey.Telemetry] !== false;

export function usageSession({ identity: identityOf, enabled, send = httpSend, now = Date.now, every = intervalEvery, newId = randomUUID }: UsageHost) {
  const sessionId = newId();
  let identity: Identity | null = null;
  let queue: UsageEvent[] = [];
  let edits = 0;
  let startedAt = 0;
  let stopTimer: (() => void) | null = null;
  let state: 'idle' | 'running' | 'ended' = 'idle';

  const event = (kind: UsageKind, extra: Partial<UsageEvent> = {}): UsageEvent => {
    identity ??= identityOf();
    return {
      event: kind,
      install_id: identity.installId,
      session_id: sessionId,
      ext_version: identity.version,
      editor: identity.editor,
      os: identity.os,
      arch: identity.arch,
      device: identity.device,
      ...extra
    };
  };

  async function flush() {
    if (!enabled()) {
      queue = [];
      return;
    }
    if (queue.length === 0) {
      return;
    }
    const batch = queue;
    queue = [];
    try {
      await send(batch);
    } catch {
      return;
    }
  }

  function begin() {
    if (state !== 'idle') {
      return;
    }
    state = 'running';
    startedAt = now();
    if (enabled()) {
      queue.push(event(UsageKind.SessionStart));
    }
    stopTimer = every(FLUSH_INTERVAL_MS, () => void flush());
  }

  function edit() {
    if (state !== 'running') {
      return;
    }
    edits++;
    if (enabled()) {
      queue.push(event(UsageKind.Edit));
    }
  }

  async function end() {
    if (state !== 'running') {
      return;
    }
    state = 'ended';
    stopTimer?.();
    if (enabled()) {
      queue.push(event(UsageKind.SessionEnd, { duration_ms: now() - startedAt, edit_count: edits }));
    }
    await flush();
  }

  function recheck() {
    if (!enabled()) {
      queue = [];
    }
  }

  return { begin, edit, end, recheck };
}

export type UsageSession = ReturnType<typeof usageSession>;
