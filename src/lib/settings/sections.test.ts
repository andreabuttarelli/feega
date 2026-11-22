import { describe, expect, it } from 'vitest';
import { SettingsSection, settingsTarget } from './sections';

const DASHBOARD_API = '/api/v1/me/settings';

describe('a settings form posts to the API of the section its action names', () => {
  it('a dashboard settings path posts to the dashboard API', () => {
    expect(settingsTarget('?/updateProfile', '/app/settings/profile/')).toEqual({ api: DASHBOARD_API, section: SettingsSection.Profile, action: 'updateProfile' });
  });

  it('a page outside settings, or an unknown section, is not a target', () => {
    expect(settingsTarget('?/rename', '/app/project')).toBeNull();
    expect(settingsTarget('/auth/signout', '/app/settings/profile')).toBeNull();
    expect(settingsTarget('?/x', '/app/settings/unknown')).toBeNull();
  });
});
