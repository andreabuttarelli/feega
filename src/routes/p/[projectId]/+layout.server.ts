import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { listMemberships } from '$lib/server/repos/orgs';
import { listProjects } from '$lib/server/repos/projects';
import { listCanvases } from '$lib/server/repos/canvas';
import { findProjectForUser } from '$lib/server/projects/lookup';
import { LAST_PROJECT_COOKIE } from '$lib/server/tenancy/context';
import { ensureProfile } from '$lib/server/repos/profiles';
import { PROJECT_BRAND_SHELL_SELECT, projectBrandShellOf, type ProjectBrandShell } from '$lib/server/projects/brand-shell';
import { orgCreditBalance } from '$lib/server/credits';
import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { CANVAS_LIST_DEPENDENCY } from '$lib/canvas/canvas-list';

const FLAGS = {
  navTeam: env.FEATURE_NAV_TEAM === 'true'
};

/**
 * IL GUSCIO DEL PROGETTO: la stessa pagina di `/app/[brand]`, con il progetto al posto del brand.
 *
 * Il progetto è il contenitore — tele, pagine, materiali. Il brand resta una PROPRIETÀ del
 * progetto (`projects.brand_id`, nullable): si apre una tela per esplorare, e solo quando il
 * materiale diventa qualcosa da pubblicare si decide per chi.
 */
export const load: LayoutServerLoad = async ({ params, locals, depends, cookies }) => {
  depends('app:credits', CANVAS_LIST_DEPENDENCY);

  const { session, user } = await locals.safeGetSession();
  if (!session || !user) {
    throw redirect(303, '/login');
  }

  const db = await locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }

  const [profile, memberships] = await Promise.all([ensureProfile(db, user), listMemberships(db, user.id)]);
  const found = await findProjectForUser(db, { projectId: params.projectId ?? '', memberships });
  if (!found) {
    throw error(404, 'questo progetto non esiste, o non è tuo');
  }

  const { orgId, project } = found;
  const membership = memberships.find((m) => m.org.id === orgId)!;
  const [projects, canvases, brand, creditBalance] = await Promise.all([
    listProjects(db, orgId),
    listCanvases(db, { orgId, projectId: project.id }),
    loadBrandShell(db, orgId, project.brandId),
    orgCreditBalance(db, orgId)
  ]);

  // Dove atterra chi rientra: l'ultimo progetto aperto, letto da `homePathFor` — non il più
  // nuovo per nascita (vedi `src/lib/server/tenancy/entry.ts`).
  cookies.set(LAST_PROJECT_COOKIE, project.id, { path: '/', maxAge: 60 * 60 * 24 * 365 });

  return {
    profile: { name: profile.name, email: profile.email, avatarUrl: profile.avatarUrl },
    org: { id: orgId, name: membership.org.name, slug: membership.org.slug, role: membership.role },
    project,
    brand,
    creditBalance,
    projects: projects.map((p) => {
      const first = p.id === project.id ? canvases[0] : undefined;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        href: `/p/${p.id}`,
        brandId: p.brandId,
        active: p.id === project.id,
        firstCanvasId: first?.id ?? null,
        updatedAt: p.lastActiveAt
      };
    }),
    canvases: canvases.map((c) => ({ id: c.id, name: c.name, href: `/p/${project.id}/c/${c.id}` })),
    workspaces: memberships.map((m) => ({ id: m.org.id, name: m.org.name, slug: m.org.slug })),
    flags: FLAGS
  };
};

async function loadBrandShell(db: Db, orgId: string, brandId: string | null): Promise<ProjectBrandShell | null> {
  if (!brandId) {
    return null;
  }
  const { data, error: brandError } = await db
    .from('brands')
    .select(PROJECT_BRAND_SHELL_SELECT)
    .eq('id', brandId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (brandError) {
    throw error(500, brandError.message);
  }
  return data ? projectBrandShellOf(data) : null;
}
