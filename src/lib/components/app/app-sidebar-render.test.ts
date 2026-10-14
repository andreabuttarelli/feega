import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { ComponentProps } from 'svelte';
import '$lib/i18n';
import AppSidebar from './AppSidebar.svelte';
import { TOOLS } from '$lib/tools';

const PROPS: ComponentProps<typeof AppSidebar> = {
  pathname: '/app',
  projectId: 'p1',
  projects: [{ id: 'p1', name: 'Spring launch' }],
  profile: { name: 'Ada Lovelace', email: 'ada@example.com', avatarUrl: null },
  org: { id: 'o1', name: 'Acme' },
  workspaces: [{ id: 'o1', name: 'Acme' }],
  creditBalance: 1200
};

const html = (over: Partial<ComponentProps<typeof AppSidebar>> = {}) => render(AppSidebar, { props: { ...PROPS, ...over } }).body;

describe('app sidebar', () => {
  it('shows the wordmark as text', () => {
    expect(html()).toMatch(/class="wordmark[^"]*"[^>]*>feega<\/a>/);
  });

  it('is a simple nav: home, canvases, templates, tools, then the projects; no tool rows, no badges', () => {
    const body = html();
    const at = (needle: string) => body.indexOf(needle);

    expect(at('href="/app"')).toBeLessThan(at('href="/app/canvases"'));
    expect(at('href="/app/canvases"')).toBeLessThan(at('href="/app/templates"'));
    expect(at('href="/app/templates"')).toBeLessThan(at('href="/app/tools"'));
    expect(at('href="/app/tools"')).toBeLessThan(at('>Projects<'));
    for (const tool of TOOLS) {
      expect(body).not.toContain(tool.name);
    }
    expect(body).not.toMatch(/class="badge[^"]*"/);
  });

  it('ends the projects section with a light New project entry', () => {
    const body = html();
    expect(body).toContain('action="/app?/project"');
    expect(body).toContain('New project');
    expect(body.indexOf('Spring launch')).toBeLessThan(body.indexOf('New project'));
  });

  it('offers New project even with no projects yet', () => {
    expect(html({ projects: [] })).toContain('action="/app?/project"');
  });

  it('lists the projects', () => {
    expect(html()).toContain('href="/p/p1"');
    expect(html()).toContain('Spring launch');
  });

  it('marks only the current page as active', () => {
    const body = html({ pathname: '/app/templates' });
    expect(body.match(/aria-current="page"/g)?.length).toBe(1);
    expect(body).toMatch(/href="\/app\/templates"[^>]*aria-current="page"/);
  });

  it('keeps account entries: settings, billing, changelog, report, legal, theme, sign out', () => {
    const body = html();
    expect(body).toContain('href="/p/p1/settings/project"');
    expect(body).toContain('href="/app/credits"');
    expect(body).toContain('href="/changelog"');
    expect(body).toContain('href="/report"');
    expect(body).toContain('href="https://feega.app/terms"');
    expect(body).toContain('data-testid="theme-switch"');
    expect(body).toContain('action="/auth/signout"');
  });

  it('reopens the tour from How feega works', () => {
    expect(html()).toMatch(/data-testid="open-tour"[^>]*>[\s\S]*How feega works/);
  });

  it('keeps credits without a project', () => {
    expect(html({ projectId: null, projects: [] })).toContain('href="/app/credits"');
  });
});

describe('account menu at the foot of the sidebar', () => {
  const menu = (body: string) => body.slice(body.indexOf('data-testid="account-menu"'));

  it('the foot shows avatar, name and email, and opens a closed menu', () => {
    const body = html();
    expect(body).toContain('ada@example.com');
    expect(body).toMatch(/data-testid="account-toggle"[^>]*aria-expanded="false"|aria-expanded="false"[^>]*data-testid="account-toggle"/);
    expect(body).toMatch(/<div[^>]*data-testid="account-menu"[^>]*hidden/);
  });

  it('every account entry lives in the menu, after the projects', () => {
    const body = html();
    const inside = menu(body);
    for (const needle of ['href="/p/p1/settings/project"', 'href="/app/credits"', 'href="/changelog"', 'href="/report"', 'data-testid="open-tour"', 'href="https://feega.app/terms"', 'data-testid="theme-switch"', 'action="/auth/signout"']) {
      expect(inside).toContain(needle);
    }
    expect(body.indexOf('New project')).toBeLessThan(body.indexOf('data-testid="account-menu"'));
  });

  it('billing in the menu shows the credit balance', () => {
    const inside = menu(html({ creditBalance: 995618 }));
    expect(inside.slice(inside.indexOf('href="/app/credits"'), inside.indexOf('href="/changelog"'))).toMatch(/9[,.]?956/);
  });
});
