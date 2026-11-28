import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SETTINGS_FILE_ENV, SettingKey } from '../settings';
import { nodePlatform } from './node-platform';
import type { Transport } from './platform';

const transport = { send: async () => undefined, receive: () => undefined } as unknown as Transport;

const platformWith = (env: NodeJS.ProcessEnv) => {
  const root = mkdtempSync(join(tmpdir(), 'feega-np-'));
  return { root, platform: nodePlatform({ root, launcher: join(root, 'launcher', 'x.js'), version: '0', transport, print: () => undefined, env }) };
};

describe('nodePlatform settings file', () => {
  it('writes to the file named by FEEGA_SETTINGS_FILE instead of the project', async () => {
    const shared = join(mkdtempSync(join(tmpdir(), 'feega-shared-')), 'editor-settings.json');
    const { platform } = platformWith({ [SETTINGS_FILE_ENV]: shared });

    await platform.setSetting(SettingKey.Notifications, false);

    expect(JSON.parse(readFileSync(shared, 'utf8'))).toEqual({ [SettingKey.Notifications]: false });
  });

  it('picks up a change another process wrote to the shared file', () => {
    const shared = join(mkdtempSync(join(tmpdir(), 'feega-shared-')), 'editor-settings.json');
    writeFileSync(shared, '{}');
    const { platform } = platformWith({ [SETTINGS_FILE_ENV]: shared });

    expect(platform.settings()[SettingKey.Notifications]).toBe(true);

    writeFileSync(shared, JSON.stringify({ [SettingKey.Notifications]: false }));
    const later = new Date(Date.now() + 5000);
    utimesSync(shared, later, later);

    expect(platform.settings()[SettingKey.Notifications]).toBe(false);
  });

  it('keeps the project file when the variable is absent', async () => {
    const { root, platform } = platformWith({});

    await platform.setSetting(SettingKey.Notifications, false);

    expect(JSON.parse(readFileSync(join(root, '.feega', 'settings.json'), 'utf8'))).toEqual({ [SettingKey.Notifications]: false });
  });
});
