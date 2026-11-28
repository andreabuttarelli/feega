import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLOUD_SETTING } from './cloud-flag';
import { SETTINGS, SettingGroup, groupedSettings, helpLinks, issueUrl } from './settings';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const SETTINGS_JSON_ONLY = ['feegaInspect.plugins.dev'];
const declared = manifest.contributes.configuration.properties as Record<string, { default: unknown; enum?: string[] }>;

describe('settings', () => {
  it('every menu row is a setting declared in package.json, with the same default', () => {
    for (const row of SETTINGS) {
      expect(declared[row.key]?.default).toEqual(row.fallback);
    }
  });

  it('choice rows offer exactly the values package.json allows', () => {
    for (const row of SETTINGS.filter((r) => r.choices)) {
      expect(row.choices!.map((c) => c.value)).toEqual(declared[row.key].enum);
    }
  });

  it('every declared setting has a menu row', () => {
    expect(Object.keys(declared).filter((key) => key !== CLOUD_SETTING && !SETTINGS_JSON_ONLY.includes(key)).sort()).toEqual(SETTINGS.map((r) => r.key).sort());
  });

  it('the problem report carries version and framework, no code', () => {
    const url = new URL(issueUrl({ version: '0.1.0', framework: 'sveltekit', styling: 'css' }));

    expect(url.searchParams.get('body')).toContain('0.1.0');
    expect(url.searchParams.get('body')).toContain('sveltekit');
  });
});

describe('grouped settings', () => {
  it('keeps every row, once, under a group', () => {
    const rows = groupedSettings().flatMap((g) => g.rows);

    expect(rows.map((r) => r.key).sort()).toEqual(SETTINGS.map((r) => r.key).sort());
  });

  it('lists groups in menu order, none empty', () => {
    expect(groupedSettings().map((g) => g.group)).toEqual([SettingGroup.General, SettingGroup.DevServer, SettingGroup.Agents, SettingGroup.Notifications]);
  });
});

describe('the help links', () => {
  it('offer docs, changelog, feedback on Discord and a bug report', () => {
    const links = helpLinks(null);

    expect(links.map((l) => l.label)).toEqual(['Documentation', "What's new", 'Send feedback', 'Report a problem']);
    expect(links.find((l) => l.label === 'Send feedback')?.url).toBe('https://discord.gg/PUp37DG6vr');
  });

  it('prefill the bug report when the facts are known', () => {
    const facts = { version: '0.1.0', framework: 'next', styling: 'css' };

    expect(helpLinks(facts).find((l) => l.label === 'Report a problem')?.url).toBe(issueUrl(facts));
  });
});
