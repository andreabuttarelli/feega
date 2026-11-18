import { describe, expect, it } from 'vitest';
import { SettingsSection, settingsTarget } from './sections';

const PROJECT_API = '/api/v1/me/projects/p1/settings';
const DASHBOARD_API = '/api/v1/me/settings';

describe('a settings form posts to the API of the section its action names', () => {
  it('a relative action is the current section', () => {
    expect(settingsTarget('?/rename', '/p/p1/settings/project')).toEqual({ api: PROJECT_API, section: SettingsSection.Project, action: 'rename' });
  });

  it('an absolute action names another section', () => {
    expect(settingsTarget('/p/p1/settings/project?/linkBrand', '/p/p1/settings/brand')).toEqual({ api: PROJECT_API, section: SettingsSection.Project, action: 'linkBrand' });
  });

  it('a dashboard settings path posts to the dashboard API', () => {
    expect(settingsTarget('?/saveCap', '/app/settings/spend')).toEqual({ api: DASHBOARD_API, section: SettingsSection.Spend, action: 'saveCap' });
    expect(settingsTarget('?/updateProfile', '/app/settings/profile/')).toEqual({ api: DASHBOARD_API, section: SettingsSection.Profile, action: 'updateProfile' });
  });

  it('a dashboard brand path posts to the API of the brand in the URL', () => {
    expect(settingsTarget('?/saveKit', '/app/settings/brands/b1/brand')).toEqual({ api: `${DASHBOARD_API}/brands/b1`, section: SettingsSection.Brand, action: 'saveKit' });
    expect(settingsTarget('?/updateVideoDuration', '/app/settings/brands/b2/video/')).toEqual({ api: `${DASHBOARD_API}/brands/b2`, section: SettingsSection.Video, action: 'updateVideoDuration' });
  });

  it('a section that stays on the server, or a page outside settings, is not a target', () => {
    expect(settingsTarget('?/select', '/p/p1/settings/facebook')).toBeNull();
    expect(settingsTarget('?/deleteBrand', '/app/brand')).toBeNull();
    expect(settingsTarget('/auth/signout', '/p/p1/settings/profile')).toBeNull();
    expect(settingsTarget('?/x', '/app/settings/unknown')).toBeNull();
  });
});
