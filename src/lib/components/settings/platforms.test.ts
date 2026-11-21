import { describe, expect, it } from 'vitest';
import { SettingsSection } from '$lib/settings/sections';
import { dashboardSettingsHref, sectionEditable, servedOnDashboard, SETTINGS_NAV, SETTINGS_SECTIONS } from './platforms';

describe('the settings sections of the account app', () => {
  it('lists only the pages that exist: profile, then billing', () => {
    expect(SETTINGS_SECTIONS.map((s) => s.path)).toEqual([SettingsSection.Profile, SettingsSection.Billing]);
  });

  it('every section is a routable settings section', () => {
    expect(SETTINGS_SECTIONS.map((s) => s.path).toSorted()).toEqual(Object.values(SettingsSection).toSorted());
  });

  it('builds one nav entry per section, pointing at its page', () => {
    expect(SETTINGS_NAV).toEqual([
      { section: 'profile', labelKey: 'app.settings.profile.title', href: '/app/settings/profile' },
      { section: 'billing', labelKey: 'app.settings.billing.title', href: '/app/settings/billing' }
    ]);
    expect(dashboardSettingsHref(SettingsSection.Billing)).toBe('/app/settings/billing');
  });

  it('serves every section on the dashboard', () => {
    expect(servedOnDashboard(SettingsSection.Billing)).toBe(true);
    expect(servedOnDashboard(SettingsSection.Profile)).toBe(true);
  });
});

describe('who may edit a settings section', () => {
  it('everyone keeps their own profile, a viewer included', () => {
    expect(sectionEditable('/app/settings/profile', 'viewer')).toBe(true);
  });

  it('billing gates its own buttons, so the page is never inert', () => {
    expect(sectionEditable('/app/settings/billing', 'viewer')).toBe(true);
    expect(sectionEditable('/app/settings/billing/', 'member')).toBe(true);
  });
});
