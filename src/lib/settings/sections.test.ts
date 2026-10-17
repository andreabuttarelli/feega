import { describe, expect, it } from 'vitest';
import { SettingsSection, settingsTarget } from './sections';

describe('a settings form posts to the API of the section its action names', () => {
  it('a relative action is the current section', () => {
    expect(settingsTarget('?/rename', '/p/p1/settings/project')).toEqual({ projectId: 'p1', section: SettingsSection.Project, action: 'rename' });
  });

  it('an absolute action names another section', () => {
    expect(settingsTarget('/p/p1/settings/project?/linkBrand', '/p/p1/settings/brand')).toEqual({ projectId: 'p1', section: SettingsSection.Project, action: 'linkBrand' });
  });

  it('a section that stays on the server, or a page outside settings, is not a target', () => {
    expect(settingsTarget('?/select', '/p/p1/settings/facebook')).toBeNull();
    expect(settingsTarget('?/deleteBrand', '/app/brand')).toBeNull();
    expect(settingsTarget('/auth/signout', '/p/p1/settings/profile')).toBeNull();
  });
});
