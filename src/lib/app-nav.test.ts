import { describe, expect, it } from 'vitest';
import { TOOLS, ToolRole } from '$lib/tools';
import { APP_NAV, NavKind, NavSection, isNavActive, navHref, visibleNav } from './app-nav';

const PROJECT = 'p1';

describe('app sidebar table', () => {
  it('opens with New video, then home, motion and the gallery', () => {
    const main = APP_NAV.filter((item) => item.section === NavSection.Main);
    expect(main.map((item) => item.id)).toEqual(['new-video', 'home', 'tool:motion', 'gallery']);
    expect(navHref(main[0], null)).toBe('/app#video-brief');
  });

  it('lists every supporting tool of tools.ts, in order', () => {
    const tools = APP_NAV.filter((item) => item.section === NavSection.Tools);
    expect(tools.map((item) => item.id)).toEqual(TOOLS.filter((tool) => tool.role === ToolRole.Support).map((tool) => `tool:${tool.id}`));
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

  it('links tools to the most recent project', () => {
    const studio = APP_NAV.find((item) => item.id === 'tool:studio')!;
    expect(navHref(studio, PROJECT)).toBe('/app/studio?project=p1');
    expect(navHref(studio, null)).toBe('/app/studio');
  });

  it('links credits to the workspace page, with or without a project', () => {
    const billing = APP_NAV.find((item) => item.id === 'billing')!;
    expect(navHref(billing, PROJECT)).toBe('/app/credits');
    expect(navHref(billing, null)).toBe('/app/credits');
  });

  it('only links are navigable', () => {
    const controls = APP_NAV.filter((item) => item.kind !== NavKind.Link).map((item) => item.id);
    expect(controls).toEqual(['legal', 'theme', 'logout']);
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
