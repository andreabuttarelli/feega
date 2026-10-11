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

  it('lists every tool from tools.ts with its link and a beta badge', () => {
    const body = html();
    for (const tool of TOOLS) {
      expect(body).toContain(`href="${tool.route}?project=p1"`);
      expect(body).toContain(tool.name);
    }
    expect(body.match(/class="badge[^"]*"/g)?.length).toBe(TOOLS.filter((t) => t.status === 'beta').length);
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
    const body = html({ pathname: '/app/motion' });
    expect(body.match(/aria-current="page"/g)?.length).toBe(1);
    expect(body).toMatch(/href="\/app\/motion\?project=p1"[^>]*aria-current="page"/);
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
