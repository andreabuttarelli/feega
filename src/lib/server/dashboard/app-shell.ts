import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { ensureProfile } from '$lib/server/repos/profiles';
import { listMemberships } from '$lib/server/repos/orgs';
import { listProjects } from '$lib/server/repos/projects';
import { orgCreditBalance } from '$lib/server/credits';
import { chooseOrg, ORG_COOKIE } from '$lib/server/tenancy/context';
import { HOME_PATH } from '$lib/home-path';
import { ProjectMode } from '$lib/project-mode';

export type AppShell = {
  profile: { name: string | null; email: string; avatarUrl: string | null };
  org: { id: string; name: string; slug: string; role: string };
  workspaces: { id: string; name: string }[];
  creditBalance: number;
  projects: { id: string; name: string }[];
};

type ShellEvent = Pick<RequestEvent, 'locals' | 'cookies'>;

export async function signedInDb(event: Pick<RequestEvent, 'locals'>): Promise<{ db: Db; user: User }> {
  const { session, user } = await event.locals.safeGetSession();
  if (!session || !user) {
    throw redirect(303, '/login');
  }

  const db = await event.locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }
  return { db, user };
}

export async function appShell(event: ShellEvent): Promise<AppShell> {
  const { db, user } = await signedInDb(event);
  const [profile, memberships] = await Promise.all([ensureProfile(db, user), listMemberships(db, user.id)]);
  const membership = chooseOrg(memberships, event.cookies.get(ORG_COOKIE) ?? null);
  if (!membership) {
    throw redirect(303, HOME_PATH);
  }

  const [creditBalance, projects] = await Promise.all([orgCreditBalance(db, membership.org.id), listProjects(db, membership.org.id)]);

  return {
    profile: { name: profile.name, email: profile.email, avatarUrl: profile.avatarUrl },
    org: { id: membership.org.id, name: membership.org.name, slug: membership.org.slug, role: membership.role },
    workspaces: memberships.map((m) => ({ id: m.org.id, name: m.org.name })),
    creditBalance,
    projects: projects.filter((p) => p.mode === ProjectMode.Standard).map((p) => ({ id: p.id, name: p.name }))
  };
}
