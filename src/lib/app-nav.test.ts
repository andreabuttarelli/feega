import { describe, expect, it } from 'vitest';
import { APP_NAV, NavKind, NavSection, isNavActive, navHref, visibleNav } from './app-nav';

const PROJECT = 'p1';

describe('app sidebar table', () => {
  it('is four plain entries: home, canvases, templates, tools — no badges', () => {
    const main = APP_NAV.filter((item) => item.section === NavSection.Main);
    expect(main.map((item) => item.id)).toEqual(['home', 'canvases', 'templates', 'tools']);
    expect(main.map((item) => navHref(item, null))).toEqual(['/app', '/app/canvases', '/app/templates', '/app/tools']);
    expect(main.every((item) => item.badge === null)).toBe(true);
  });

  it('every tool and the gallery live behind the one tools entry, not in the sidebar', () => {
    const ids = APP_NAV.map((item) => item.id);
    expect(ids.some((id) => id.startsWith('tool:'))).toBe(false);
    expect(ids).not.toContain('gallery');
  });

  it('keeps every entry the old burger menu had in /app', () => {
    const ids = APP_NAV.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(['home', 'settings', 'billing', 'changelog', 'report', 'legal', 'theme', 'logout']));
  });

  it('hides project-bound entries when there is no project', () => {
    const ids = visibleNav(null).map((item) => item.id);
    expect(ids).not.toContain('settings');
    expect(ids).toContain('billing');
  });

  it('links credits to the workspace page, with or without a project', () => {
    const billing = APP_NAV.find((item) => item.id === 'billing')!;
    expect(navHref(billing, PROJECT)).toBe('/app/credits');
    expect(navHref(billing, null)).toBe('/app/credits');
  });

  it('only links are navigable', () => {
    const controls = APP_NAV.filter((item) => item.kind !== NavKind.Link).map((item) => item.id);
    expect(controls).toEqual(['tour', 'legal', 'theme', 'logout']);
  });
});

describe('active entry', () => {
  it('dashboard is active only on /app itself', () => {
    expect(isNavActive('/app', '/app')).toBe(true);
    expect(isNavActive('/app', '/app/motion')).toBe(false);
  });

  it('a tool is active on its page and below, ignoring the query', () => {
    expect(isNavActive('/app/motion?project=p1', '/app/motion')).toBe(true);
    expect(isNavActive('/app/motion?project=p1', '/app/motion/abc')).toBe(true);
    expect(isNavActive('/app/motion', '/app/motionx')).toBe(false);
  });
});
