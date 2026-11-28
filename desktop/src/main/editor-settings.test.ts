import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SettingKey } from '../../../inspect/src/settings';
import { editorSettings, editorSettingsPath } from './editor-settings';

const pathIn = () => editorSettingsPath(mkdtempSync(join(tmpdir(), 'feega-desktop-')));

describe('editorSettings', () => {
  it('reads defaults when nothing is stored', () => {
    expect(editorSettings(pathIn()).get()[SettingKey.Notifications]).toBe(true);
  });

  it('writes the same flat file the editor reads', () => {
    const path = pathIn();

    editorSettings(path).set(SettingKey.Styling, 'css');

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ [SettingKey.Styling]: 'css' });
  });

  it('sees what the editor wrote', () => {
    const path = pathIn();
    const store = editorSettings(path);
    store.set(SettingKey.Styling, 'css');
    writeFileSync(path, JSON.stringify({ [SettingKey.Styling]: 'tailwind' }));

    expect(store.get()[SettingKey.Styling]).toBe('tailwind');
  });

  it('carries an opted-out desktop preference over once, without overriding a later choice', () => {
    const store = editorSettings(pathIn());

    store.adoptTelemetryOff();
    expect(store.get()[SettingKey.Telemetry]).toBe(false);

    store.set(SettingKey.Telemetry, true);
    store.adoptTelemetryOff();
    expect(store.get()[SettingKey.Telemetry]).toBe(true);
  });
});
