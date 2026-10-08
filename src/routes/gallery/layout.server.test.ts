import { describe, expect, it, vi } from 'vitest';
import { APP_NAV, isNavActive, navHref, visibleNav } from '$lib/app-nav';

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

  it('the sidebar has Gallery for everyone, active on the gallery and its items', () => {
    const gallery = APP_NAV.find((item) => item.id === 'gallery')!;
    expect(visibleNav(null)).toContain(gallery);
    const href = navHref(gallery, null)!;
    expect(href).toBe('/gallery');
    expect(isNavActive(href, '/gallery')).toBe(true);
    expect(isNavActive(href, '/gallery/abc')).toBe(true);
    expect(isNavActive(href, '/app')).toBe(false);
  });
});
