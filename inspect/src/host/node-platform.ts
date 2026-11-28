import { publishLocal } from './local-bridge/publish';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { ToView } from '../messages';
import { SETTINGS_FILE_ENV, settingsWith, type SettingValue } from '../settings';
import { pluginsRoot } from '@feega/plugin-store/registry';
import { fileAccountStore, type AccountStore } from './account';
import { machineAgents } from './agents';
import { fileOnboardingStore, type OnboardingStore } from './onboarding';
import { fileSupportStore, type SupportStore } from './support';
import { nodeGit } from './node-git';
import { catalogFile } from './library';
import { openTarget } from './open-source';
import { Stored, type Platform, type Transport } from './platform';
import type { PluginsHost } from './plugins-session';
import { HintSurface, nodeSkillHint } from './skill-hint';
import { Device, Editor, fileFirstEdit, fileInstallStore, installOf, nodeUsageEnabled, type FirstEditFlag, type InstallStore } from './usage';

const FEEGA_DIR = '.feega';
const ADAPTERS_DIR = 'adapters';
const SETTINGS_FILE = 'settings.json';
const STATE_FILE = 'state.json';
const CACHE_DIR = 'feega';
const STATE_KEY_LENGTH = 16;
const OPENERS: Partial<Record<NodeJS.Platform, string[]>> = { darwin: ['open'], win32: ['cmd', '/c', 'start', ''] };
const LINUX_OPENER = ['xdg-open'];
const SESSION_ONLY = new Set<string>([Stored.History]);
const FULL_WIDTH = 'full';

export type Launch = (command: string, args: string[]) => Promise<boolean>;

export type NodeHost = { root: string; launcher: string; version: string; transport: Transport; print: (line: string) => void; launch?: Launch; env?: NodeJS.ProcessEnv; account?: AccountStore; onboarding?: OnboardingStore; support?: SupportStore; install?: InstallStore; firstEdit?: FirstEditFlag; cloud?: Platform['cloud']; share?: Platform['share']; plugins?: PluginsHost };

export const launchDetached: Launch = (command, args) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.once('error', () => resolve(false));
    child.once('spawn', () => (child.unref(), resolve(true)));
  });

const readJson = (path: string): Record<string, unknown> => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
};

const modifiedAt = (path: string): number => {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
};

const freshLaunch = (state: Record<string, unknown>): Record<string, unknown> => {
  const prefs = state[Stored.Prefs];
  return prefs && typeof prefs === 'object' ? { ...state, [Stored.Prefs]: { ...prefs, size: FULL_WIDTH, custom: null } } : state;
};

const cacheRoot = (env: NodeJS.ProcessEnv) => join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), CACHE_DIR);

const stateDirFor = (root: string, env: NodeJS.ProcessEnv) => {
  const key = createHash('sha256').update(root).digest('hex').slice(0, STATE_KEY_LENGTH);
  return join(cacheRoot(env), key);
};

export function nodePlatform({ root, launcher, version, transport, print, launch = launchDetached, env = process.env, account = fileAccountStore(), onboarding = fileOnboardingStore(), support = fileSupportStore(), install = fileInstallStore(), firstEdit = fileFirstEdit(), cloud, share, plugins = { root: pluginsRoot(), dev: () => [] } }: NodeHost): Platform {
  const dir = join(root, FEEGA_DIR);
  const settingsPath = env[SETTINGS_FILE_ENV] || join(dir, SETTINGS_FILE);
  const stateDir = stateDirFor(root, env);
  const statePath = join(stateDir, STATE_FILE);
  let settings = readJson(settingsPath) as Record<string, SettingValue>;
  let settingsSeen = modifiedAt(settingsPath);
  const currentSettings = () => {
    const modified = modifiedAt(settingsPath);
    if (modified !== settingsSeen) {
      settings = readJson(settingsPath) as Record<string, SettingValue>;
      settingsSeen = modified;
    }
    return settings;
  };
  const state = freshLaunch(readJson(statePath));
  const session = new Map<string, unknown>();

  const save = async (path: string, value: object) => {
    mkdirSync(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  };

  async function edit(path: string, line = 0, col = 0) {
    if (await launch('code', ['-g', `${path}:${line + 1}:${col + 1}`])) {
      return;
    }
    const editor = env.VISUAL || env.EDITOR;
    if (editor && (await launch(editor, [path]))) {
      return;
    }
    print(`${path}:${line + 1}:${col + 1}`);
  }

  async function showDiff(path: string, before: string) {
    const left = join(await mkdtemp(join(tmpdir(), 'feega-before-')), basename(path));
    await writeFile(left, before);
    if (await launch('code', ['--diff', left, path])) {
      return;
    }
    print(`before: ${left}\nnow:    ${path}`);
  }

  const openExternal = (url: string) => {
    const [command, ...args] = OPENERS[process.platform] ?? LINUX_OPENER;
    return launch(command, [...args, url]);
  };

  return {
    version,
    launcher,
    ...transport,
    settings: () => settingsWith((row) => currentSettings()[row.key]),
    setSetting: async (key, value) => {
      currentSettings()[key] = value;
      await save(settingsPath, settings);
      settingsSeen = modifiedAt(settingsPath);
    },
    stored: <T>(key: Stored) => (SESSION_ONLY.has(key) ? session.get(key) : state[key]) as T | undefined,
    store: async (key, value) => {
      if (SESSION_ONLY.has(key)) {
        session.set(key, value);
        return;
      }
      state[key] = value;
      await save(statePath, state);
    },
    log: (line) => print(line.trimEnd()),
    showLogs: () => print('feega: the dev server logs are in this terminal'),
    openSource: (from, at) => {
      const target = openTarget(from, at, undefined);
      return edit(target.path, target.line, target.col);
    },
    showDiff,
    confirm: async () => true,
    chooseApp: async (apps, workspace) => (print(`feega: ${workspace} holds several apps, run feega on one of:\n${apps.map((app) => `  ${join(workspace, app)}`).join('\n')}`), null),
    openExternal,
    openSettings: async () => {
      await save(settingsPath, currentSettings());
      return edit(settingsPath);
    },
    sourceControl: () => print(`feega: review the changes with \`git -C ${root} diff\``),
    git: (at) => nodeGit(at, env),
    notify: (text) => print(`feega: ${text}`),
    warn: async (text) => (print(`feega: ${text}`), false),
    alerts: { show: async (alert) => (await transport.send({ kind: ToView.Alert, alert }), false), clear: (chat) => void transport.send({ kind: ToView.AlertClear, chat }) },
    library: catalogFile(join(dirname(launcher), 'library.json')),
    account,
    cloud,
    share,
    plugins,
    onboarding,
    support,
    skillHint: nodeSkillHint(HintSurface.Terminal),
    localBridge: publishLocal,
    adapterDir: join(cacheRoot(env), ADAPTERS_DIR),
    agents: () => machineAgents(),
    usage: {
      identity: () => ({ ...installOf(install), version, editor: Editor.Npx, os: process.platform, arch: process.arch, device: Device.Cli }),
      enabled: () => nodeUsageEnabled(env, settingsWith((row) => currentSettings()[row.key])),
      firstEdit
    }
  };
}
