import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { OnboardingStep } from '../messages';
import { SettingKey, type Settings } from '../settings';
import { APP_URL } from './sign-in';

export const USAGE_URL = `${APP_URL}/api/v1/telemetry`;

const FLUSH_INTERVAL_MS = 3 * 60 * 1000;
const RESUME_AFTER_MS = 30 * 60 * 1000;
const SEND_TIMEOUT_MS = 5000;
const GLOBAL_KEY = 'feegaInspect.installId';
const INSTALL_FILE = join('.config', 'feega', 'install.json');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export enum UsageKind {
  Install = 'install',
  Opened = 'opened',
  SessionStart = 'session_start',
  PreviewReady = 'preview_ready',
  FirstEdit = 'first_edit',
  Edit = 'edit',
  SessionEnd = 'session_end',
  SignIn = 'sign_in',
  SignOut = 'sign_out',
  SessionResume = 'session_resume',
  OnboardingStarted = 'onboarding_started',
  OnboardingStep = 'onboarding_step',
  OnboardingFinished = 'onboarding_finished',
  OnboardingSkipped = 'onboarding_skipped',
  SetupApplied = 'setup_applied',
  SetupFailed = 'setup_failed',
  SkillHintShown = 'skill_hint_shown',
  SkillInstalled = 'skill_installed',
  LibraryInsert = 'library_insert',
  PluginInstalled = 'plugin_installed'
}

export type LibraryTier = 'free' | 'pro';

export enum EditKind {
  Text = 'text',
  Style = 'style',
  Image = 'image',
  Attribute = 'attribute',
  Structure = 'structure',
  Template = 'template',
  Other = 'other'
}

export type UsageFacts = { framework: string | null; signedIn: boolean };

export type FirstEditFlag = { seen: () => boolean; mark: () => unknown };

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

export type Identity = { installId: string; version: string; editor: Editor; os: string; arch: string; device: Device; firstRun?: boolean };

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
  edit_kind?: EditKind;
  framework?: string;
  signed_in?: boolean;
  step?: OnboardingStep;
  tier?: LibraryTier;
};

export type Send = (events: UsageEvent[]) => Promise<unknown>;

export type UsageHost = {
  identity: () => Identity;
  enabled: () => boolean;
  send?: Send;
  now?: () => number;
  every?: (ms: number, run: () => void) => () => void;
  newId?: () => string;
  facts?: () => UsageFacts;
  firstEdit?: FirstEditFlag;
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

const FIRST_EDIT_FILE = join('.config', 'feega', 'first-edit');
const FIRST_EDIT_KEY = 'feegaInspect.firstEdit';

export const globalStateFirstEdit = (state: { get: (key: string) => unknown; update: (key: string, value: unknown) => PromiseLike<unknown> }): FirstEditFlag => ({
  seen: () => state.get(FIRST_EDIT_KEY) === true,
  mark: () => state.update(FIRST_EDIT_KEY, true)
});

export const fileFirstEdit = (path: string = join(homedir(), FIRST_EDIT_FILE)): FirstEditFlag => ({
  seen: () => existsSync(path),
  mark: () => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '');
  }
});

export const httpSend: Send = (events) =>
  fetch(USAGE_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events }), signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });

const intervalEvery = (ms: number, run: () => void) => {
  const timer = setInterval(run, ms);
  timer.unref();
  return () => clearInterval(timer);
};

export function installOf(store: InstallStore, newId: () => string = randomUUID): { installId: string; firstRun: boolean } {
  const stored = store.get();
  if (stored && UUID.test(stored)) {
    return { installId: stored, firstRun: false };
  }
  const created = newId();
  try {
    Promise.resolve(store.set(created)).catch(() => undefined);
  } catch {
    return { installId: created, firstRun: true };
  }
  return { installId: created, firstRun: true };
}

export const installIdOf = (store: InstallStore, newId?: () => string): string => installOf(store, newId).installId;

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

export function usageSession({ identity: identityOf, enabled, send = httpSend, now = Date.now, every = intervalEvery, newId = randomUUID, facts, firstEdit }: UsageHost) {
  const sessionId = newId();
  let identity: Identity | null = null;
  let queue: UsageEvent[] = [];
  let edits = 0;
  let startedAt = 0;
  let stopTimer: (() => void) | null = null;
  let state: 'idle' | 'running' | 'ended' = 'idle';
  let previewSent = false;
  let awayAt: number | null = null;

  const withFacts = (e: UsageEvent): UsageEvent => {
    const known = facts?.();
    if (!known) {
      return e;
    }
    return { ...e, ...(known.framework ? { framework: known.framework } : {}), signed_in: known.signedIn };
  };

  const firstRun = () => identity?.firstRun === true;

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
    const batch = queue.map(withFacts);
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
      const opened = event(UsageKind.Opened);
      if (firstRun()) {
        queue.push(event(UsageKind.Install));
      }
      queue.push(opened, event(UsageKind.SessionStart));
    }
    stopTimer = every(FLUSH_INTERVAL_MS, () => void flush());
  }

  function previewReady() {
    if (state !== 'running' || previewSent) {
      return;
    }
    previewSent = true;
    if (enabled()) {
      queue.push(event(UsageKind.PreviewReady));
    }
  }

  function edit(kind: EditKind = EditKind.Other) {
    if (state !== 'running') {
      return;
    }
    edits++;
    if (!enabled()) {
      return;
    }
    if (firstEdit && !firstEdit.seen()) {
      firstEdit.mark();
      queue.push(event(UsageKind.FirstEdit));
    }
    queue.push(event(UsageKind.Edit, { edit_kind: kind }));
  }

  function account(kind: UsageKind.SignIn | UsageKind.SignOut) {
    if (state === 'running' && enabled()) {
      queue.push(event(kind));
    }
  }

  function track(kind: UsageKind, extra: Pick<UsageEvent, 'step' | 'tier'> = {}) {
    if (state === 'running' && enabled()) {
      queue.push(event(kind, extra));
    }
  }

  const signedIn = () => account(UsageKind.SignIn);
  const signedOut = () => account(UsageKind.SignOut);

  const away = () => void (awayAt ??= now());

  function back() {
    const since = awayAt;
    awayAt = null;
    if (since === null || state !== 'running' || now() - since < RESUME_AFTER_MS || !enabled()) {
      return;
    }
    queue.push(event(UsageKind.SessionResume));
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

  return { begin, previewReady, edit, track, signedIn, signedOut, away, back, end, recheck };
}

export type UsageSession = ReturnType<typeof usageSession>;
