import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { settingsWith, type SettingValue } from '../../../inspect/src/settings';
import { Device, Editor, fileInstallStore, installOf, nodeUsageEnabled, usageSession, UsageKind, type InstallStore, type Send } from '../../../inspect/src/host/usage';

const SETTINGS_PATH = join('.feega', 'settings.json');
const TOOL_NAME = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const UNKNOWN_TOOL = 'unknown';

export type McpUsageHost = { cwd: string; env: NodeJS.ProcessEnv; version: string; install?: InstallStore; send?: Send };

const settingsAt = (cwd: string): Record<string, SettingValue> => {
  try {
    return JSON.parse(readFileSync(join(cwd, SETTINGS_PATH), 'utf8'));
  } catch {
    return {};
  }
};

export function mcpUsage({ cwd, env, version, install = fileInstallStore(), send }: McpUsageHost) {
  const session = usageSession({
    identity: () => ({ ...installOf(install), version, editor: Editor.Npx, os: process.platform, arch: process.arch, device: Device.Cli }),
    enabled: () => nodeUsageEnabled(env, settingsWith((row) => settingsAt(cwd)[row.key])),
    send
  });
  session.begin();

  return {
    called: (tool: string) => session.track(UsageKind.McpToolCall, { tool: TOOL_NAME.test(tool) ? tool : UNKNOWN_TOOL }),
    end: () => session.end()
  };
}
