import { describe, expect, it } from 'vitest';
import { brandRedirectOf, brandSettingsHref, canvasRedirectOf, dashboardSettingsHref, movedToDashboard, SCOPE_HOME, SettingsHome } from './platforms';

describe('where each settings scope lives', () => {
  it('only the project stays on the canvas, brand, workspace and account live on the dashboard', () => {
    expect(SCOPE_HOME).toEqual({
      project: SettingsHome.Canvas,
      brand: SettingsHome.Dashboard,
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

  it('leaves a brand section to the brand redirect, which needs the brand id', () => {
    expect(canvasRedirectOf('/p/p1/settings/video')).toBeNull();
    expect(movedToDashboard('video')).toBe(true);
  });

  it('stays for spend, which keeps the project caps on the canvas', () => {
    expect(canvasRedirectOf('/p/p1/settings/spend')).toBeNull();
    expect(movedToDashboard('spend')).toBe(false);
    expect(movedToDashboard('models')).toBe(true);
  });
});

describe('an old canvas brand URL', () => {
  it('goes to the same section of the project brand on the dashboard', () => {
    expect(brandSettingsHref('b1', 'products')).toBe('/app/settings/brands/b1/products');
    expect(brandRedirectOf('/p/p1/settings/brand', 'b1')).toBe('/app/settings/brands/b1/brand');
    expect(brandRedirectOf('/p/p1/settings/danger/', 'b1')).toBe('/app/settings/brands/b1/danger');
  });

  it('goes to the brand list when the project has no brand', () => {
    expect(brandRedirectOf('/p/p1/settings/video', null)).toBe('/app/settings/brands');
  });

  it('is not a brand section when it is a project or dashboard one', () => {
    expect(brandRedirectOf('/p/p1/settings/project', 'b1')).toBeNull();
    expect(brandRedirectOf('/p/p1/settings/profile', 'b1')).toBeNull();
  });
});
