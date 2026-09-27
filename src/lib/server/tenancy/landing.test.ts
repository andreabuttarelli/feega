import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';
import { landingPath, type LandingDeps } from '$lib/server/tenancy/landing';
import { ORG_COOKIE, LAST_PROJECT_COOKIE } from '$lib/server/tenancy/context';

const USER = { id: 'u1', email: 'b@esempio.it' } as User;
const DB = {} as never;

function cookies(values: Record<string, string> = {}): Cookies {
  return { get: (name: string) => values[name] } as unknown as Cookies;
}

function deps(outcome: Awaited<ReturnType<LandingDeps['acceptInvite']>>) {
  const order: string[] = [];
  return {
    order,
    ensureProfile: vi.fn(async () => {
      order.push('profile');
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
    expect(d.homePathFor.mock.calls[0].slice(3)).toEqual(['o1', 'p1']);
  });

  it("con un invito valido, nell'org che ha invitato, ignorando l'ultimo progetto", async () => {
    const d = deps({ outcome: 'accepted', orgId: 'org-a', role: 'member' });

    const path = await landingPath(DB, USER, cookies({ [LAST_PROJECT_COOKIE]: 'p1' }), 'tok', d);

    expect(path).toBe('/p/proj/c/canvas');
    expect(d.acceptInvite).toHaveBeenCalledWith({ token: 'tok', userId: 'u1', email: 'b@esempio.it' });
    expect(d.homePathFor.mock.calls[0].slice(3)).toEqual(['org-a', null]);
  });

  it("chi si è appena registrato ha un profilo prima che l'invito lo renda membro", async () => {
    const d = deps({ outcome: 'accepted', orgId: 'org-a', role: 'member' });

    await landingPath(DB, USER, cookies(), 'tok', d);

    expect(d.order).toEqual(['profile', 'accept']);
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
