import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';
import { landingPath, type LandingDeps } from '$lib/server/tenancy/landing';
import { ORG_COOKIE, LAST_PROJECT_COOKIE } from '$lib/server/tenancy/context';
import { EntryVia } from '$lib/server/tenancy/entry';

const USER = { id: 'u1', email: 'b@esempio.it' } as User;
const DB = {} as never;

function cookies(values: Record<string, string> = {}): Cookies {
  return {
    get: (name: string) => values[name],
    delete: (name: string) => {
      delete values[name];
    }
  } as unknown as Cookies;
}

function deps(outcome: Awaited<ReturnType<LandingDeps['acceptInvite']>>, termsAcceptedAt: string | null = null) {
  const order: string[] = [];
  return {
    order,
    ensureProfile: vi.fn(async () => {
      order.push('profile');
      return { id: USER.id, email: USER.email, name: null, avatarUrl: null, termsAcceptedAt, termsVersion: null };
    }),
    recordTermsAcceptance: vi.fn(async () => {
      order.push('terms');
    }),
    acceptInvite: vi.fn(async () => {
      order.push('accept');
      return outcome;
    }),
    homePathFor: vi.fn(async () => '/p/proj/c/canvas')
  } satisfies LandingDeps;
}

describe('dove atterra chi è appena entrato', () => {
  it('senza invito, sulla propria tela scelta dai cookie', async () => {
    const d = deps({ outcome: 'invalid' });

    const path = await landingPath(DB, USER, cookies({ [ORG_COOKIE]: 'o1', [LAST_PROJECT_COOKIE]: 'p1' }), null, d);

    expect(path).toBe('/p/proj/c/canvas');
    expect(d.acceptInvite).not.toHaveBeenCalled();
    expect(d.homePathFor.mock.calls[0].slice(3)).toEqual(['o1', 'p1', null]);
  });

  it("con un invito valido, nell'org che ha invitato, ignorando l'ultimo progetto", async () => {
    const d = deps({ outcome: 'accepted', orgId: 'org-a', role: 'member' });

    const path = await landingPath(DB, USER, cookies({ [LAST_PROJECT_COOKIE]: 'p1' }), 'tok', d);

    expect(path).toBe('/p/proj/c/canvas');
    expect(d.acceptInvite).toHaveBeenCalledWith({ token: 'tok', userId: 'u1', email: 'b@esempio.it' });
    expect(d.homePathFor.mock.calls[0].slice(3)).toEqual(['org-a', null, null, EntryVia.Invite]);
  });

  it("chi si è appena registrato ha un profilo prima che l'invito lo renda membro", async () => {
    const d = deps({ outcome: 'accepted', orgId: 'org-a', role: 'member' });

    await landingPath(DB, USER, cookies(), 'tok', d);

    expect(d.order).toEqual(['profile', 'terms', 'accept']);
  });

  it('un profilo nuovo registra l’accettazione dei termini', async () => {
    const d = deps({ outcome: 'invalid' }, null);

    await landingPath(DB, USER, cookies(), null, d);

    expect(d.recordTermsAcceptance).toHaveBeenCalledWith(DB, USER.id, expect.any(String));
  });

  it('un profilo che ha già accettato non riscrive', async () => {
    const d = deps({ outcome: 'invalid' }, '2026-01-01T00:00:00.000Z');

    await landingPath(DB, USER, cookies(), null, d);

    expect(d.recordTermsAcceptance).not.toHaveBeenCalled();
  });

  it('un invito non valido torna al login col motivo', async () => {
    expect(await landingPath(DB, USER, cookies(), 'tok', deps({ outcome: 'invalid' }))).toBe(
      '/login?invite_error=invalid'
    );
  });

  it("un invito per un'altra email torna al login col motivo", async () => {
    expect(await landingPath(DB, USER, cookies(), 'tok', deps({ outcome: 'wrong_email' }))).toBe(
      '/login?invite_error=wrong_email'
    );
  });
});

describe('a signup that came from a landing page', () => {
  it('hands the stored campaign to the landing canvas and spends the cookie', async () => {
    const d = deps({ outcome: 'invalid' });
    const jar: Record<string, string> = { feega_campaign: 'anime-video-generator' };

    await landingPath(DB, USER, cookies(jar), null, d);

    expect(d.homePathFor.mock.calls[0][5]).toBe('anime-video-generator');
    expect(jar.feega_campaign).toBeUndefined();
  });
});
