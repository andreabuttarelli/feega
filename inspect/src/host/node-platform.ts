import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { settingsWith, type SettingValue } from '../settings';
import { pluginsRoot } from '@feega/plugin-store/registry';
import { fileAccountStore, type AccountStore } from './account';
import { fileOnboardingStore, type OnboardingStore } from './onboarding';
import { openTarget } from './open-source';
import type { Platform, Stored, Transport } from './platform';
import type { PluginsHost } from './plugins-session';
import { HintSurface, nodeSkillHint } from './skill-hint';
import { Device, Editor, fileFirstEdit, fileInstallStore, installIdOf, nodeUsageEnabled, type FirstEditFlag, type InstallStore } from './usage';

const FEEGA_DIR = '.feega';
const SETTINGS_FILE = 'settings.json';
const STATE_FILE = 'state.json';
const CACHE_DIR = 'feega';
const STATE_KEY_LENGTH = 16;
const OPENERS: Partial<Record<NodeJS.Platform, string[]>> = { darwin: ['open'], win32: ['cmd', '/c', 'start', ''] };
const LINUX_OPENER = ['xdg-open'];

export type Launch = (command: string, args: string[]) => Promise<boolean>;

export type NodeHost = { root: string; launcher: string; version: string; transport: Transport; print: (line: string) => void; launch?: Launch; env?: NodeJS.ProcessEnv; account?: AccountStore; onboarding?: OnboardingStore; install?: InstallStore; firstEdit?: FirstEditFlag; cloud?: Platform['cloud']; share?: Platform['share']; plugins?: PluginsHost };

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

const stateDirFor = (root: string, env: NodeJS.ProcessEnv) => {
  const key = createHash('sha256').update(root).digest('hex').slice(0, STATE_KEY_LENGTH);
  return join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), CACHE_DIR, key);
};

export function nodePlatform({ root, launcher, version, transport, print, launch = launchDetached, env = process.env, account = fileAccountStore(), onboarding = fileOnboardingStore(), install = fileInstallStore(), firstEdit = fileFirstEdit(), cloud, share, plugins = { root: pluginsRoot(), dev: () => [] } }: NodeHost): Platform {
  const dir = join(root, FEEGA_DIR);
  const settingsPath = join(dir, SETTINGS_FILE);
  const stateDir = stateDirFor(root, env);
  const statePath = join(stateDir, STATE_FILE);
  const settings = readJson(settingsPath) as Record<string, SettingValue>;
  const state = readJson(statePath);

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
    settings: () => settingsWith((row) => settings[row.key]),
    setSetting: (key, value) => ((settings[key] = value), save(settingsPath, settings)),
    stored: <T>(key: Stored) => state[key] as T | undefined,
    store: (key, value) => ((state[key] = value), save(statePath, state)),
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
      await save(settingsPath, settings);
      return edit(settingsPath);
    },
    sourceControl: () => print(`feega: review the changes with \`git -C ${root} diff\``),
    notify: (text) => print(`feega: ${text}`),
    warn: async (text) => (print(`feega: ${text}`), false),
    account,
    cloud,
    share,
    plugins,
    onboarding,
    skillHint: nodeSkillHint(HintSurface.Terminal),
    usage: {
      identity: () => ({ installId: installIdOf(install), version, editor: Editor.Npx, os: process.platform, arch: process.arch, device: Device.Cli }),
      enabled: () => nodeUsageEnabled(env, settingsWith((row) => settings[row.key])),
      firstEdit
    }
  };
}
