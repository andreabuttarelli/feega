import { describe, expect, it } from 'vitest';
import { canvasRedirectOf, dashboardSettingsHref, movedToDashboard, SCOPE_HOME, SettingsHome } from './platforms';

describe('where each settings scope lives', () => {
  it('only the project stays on the canvas, workspace and account live on the dashboard', () => {
    expect(SCOPE_HOME).toEqual({
      project: SettingsHome.Canvas,
      workspace: SettingsHome.Dashboard,
      account: SettingsHome.Dashboard
    });
  });

  it('a dashboard section lives under /app/settings, team at the existing team page', () => {
    expect(dashboardSettingsHref('profile')).toBe('/app/settings/profile');
    expect(dashboardSettingsHref('api-keys')).toBe('/app/settings/api-keys');
    expect(dashboardSettingsHref('team')).toBe('/app/team');
  });
});

describe('an old canvas settings URL', () => {
  it('redirects a dashboard section to its dashboard home', () => {
    expect(canvasRedirectOf('/p/p1/settings/profile')).toBe('/app/settings/profile');
    expect(canvasRedirectOf('/p/p1/settings/appearance/')).toBe('/app/settings/appearance');
    expect(canvasRedirectOf('/p/p1/settings/team')).toBe('/app/team');
  });

  it('stays when the section belongs to the project', () => {
    expect(canvasRedirectOf('/p/p1/settings/project')).toBeNull();
  });

  it('stays for spend, which keeps the project caps on the canvas', () => {
    expect(canvasRedirectOf('/p/p1/settings/spend')).toBeNull();
    expect(movedToDashboard('spend')).toBe(false);
    expect(movedToDashboard('models')).toBe(true);
  });
});
