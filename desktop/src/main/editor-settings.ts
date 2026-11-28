import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SettingKey, settingsWith, type SettingValue, type Settings } from '../../../inspect/src/settings';

const FILE = 'editor-settings.json';

export const editorSettingsPath = (userData: string) => join(userData, FILE);

const read = (path: string): Record<string, SettingValue> => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
};

export function editorSettings(path: string) {
  const set = (key: SettingKey, value: SettingValue) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ ...read(path), [key]: value }, null, 2)}\n`);
  };

  return {
    get: (): Settings => settingsWith((row) => read(path)[row.key]),
    set,
    adoptTelemetryOff: () => {
      if (read(path)[SettingKey.Telemetry] === undefined) {
        set(SettingKey.Telemetry, false);
      }
    }
  };
}
