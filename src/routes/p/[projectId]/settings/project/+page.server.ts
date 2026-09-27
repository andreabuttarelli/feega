import { error, fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { archiveProject, renameProject, setProjectBrand } from '$lib/server/repos/projects';
import { findBrand, listOrgBrands } from '$lib/server/repos/brands';
import type { Db } from '$lib/server/db/client';

const EXIT_AFTER_DELETE = '/app';

type OwnedProject = { db: Db; orgId: string; projectId: string; name: string };

async function ownedProject(event: RequestEvent): Promise<OwnedProject> {
  const db = await event.locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }

  const projectId = event.params.projectId ?? '';
  const { data } = await db.from('projects').select('org_id, name').eq('id', projectId).maybeSingle();
  const row = data as { org_id: string; name: string } | null;
  if (!row) {
    throw error(404, 'progetto non trovato');
  }

  return { db, orgId: row.org_id, projectId, name: row.name };
}

function returnPathWithin(projectId: string, raw: FormDataEntryValue | null): string | null {
  const path = String(raw ?? '');
  return path.startsWith(`/p/${projectId}/`) ? path : null;
}

export const load: PageServerLoad = async ({ parent, locals }) => {
  const { project, org, brand } = await parent();
  const db = await locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }

  const orgBrands = await listOrgBrands(db, org.id);
  return {
    project: { id: project.id, name: project.name },
    linkedBrand: brand ? { id: brand.id, name: brand.name } : null,
    orgBrands: orgBrands.map((b) => ({ id: b.id, name: b.name }))
  };
};

export const actions: Actions = {
  rename: async (event) => {
    const { db, orgId, projectId } = await ownedProject(event);
    const name = String((await event.request.formData()).get('name') ?? '').trim();
    if (!name) {
      return fail(400, { error: 'name_required' });
    }

    await renameProject(db, { orgId, projectId, name });
    return { renamed: true };
  },

  linkBrand: async (event) => {
    const { db, orgId, projectId } = await ownedProject(event);
    const fd = await event.request.formData();
    const brandId = String(fd.get('brandId') ?? '').trim();
    if (!brandId) {
      return fail(400, { error: 'brand_required' });
    }

    const brand = await findBrand(db, { orgId, brandId });
    if (!brand) {
      return fail(404, { error: 'brand_not_found' });
    }

    await setProjectBrand(db, { orgId, projectId, brandId });
    const back = returnPathWithin(projectId, fd.get('returnTo'));
    if (back) {
      throw redirect(303, back);
    }
    return { linked: true };
  },

  unlinkBrand: async (event) => {
    const { db, orgId, projectId } = await ownedProject(event);
    await setProjectBrand(db, { orgId, projectId, brandId: null });
    return { unlinked: true };
  },

  delete: async (event) => {
    const { db, orgId, projectId, name } = await ownedProject(event);
    const typed = String((await event.request.formData()).get('confirmName') ?? '');
    if (typed !== name) {
      return fail(400, { error: 'name_mismatch' });
    }

    await archiveProject(db, { orgId, projectId });
    throw redirect(303, EXIT_AFTER_DELETE);
  }
};
