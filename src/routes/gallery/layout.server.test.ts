import { describe, expect, it, vi } from 'vitest';
import { APP_NAV, isNavActive, navHref, visibleNav } from '$lib/app-nav';
import { toolEntries } from '$lib/tools-page';

const shell = vi.hoisted(() => ({ profile: { name: 'Ada' }, org: { id: 'o' }, projects: [], workspaces: [], creditBalance: 0 }));
vi.mock('$lib/server/dashboard/app-shell', () => ({ appShell: async () => shell }));

const { load } = await import('./+layout.server');

const event = (user: unknown) => ({ locals: { safeGetSession: async () => ({ user, session: user ? {} : null }) } }) as never;

describe('the gallery and the app navigation', () => {
  it('a signed-in visitor sees the gallery inside the app shell', async () => {
    expect(await load(event({ id: 'u' }))).toEqual({ shell });
  });

  it('a visitor without an account sees the public gallery, no app shell', async () => {
    expect(await load(event(null))).toEqual({ shell: null });
  });

  it('the gallery is one of the tools behind the sidebar Tools entry, for everyone', () => {
    const tools = APP_NAV.find((item) => item.id === 'tools')!;
    expect(visibleNav(null)).toContain(tools);
    expect(toolEntries(null).find((t) => t.id === 'gallery')?.href).toBe('/gallery');
    expect(isNavActive(navHref(tools, null)!, '/app/tools')).toBe(true);
  });
});
