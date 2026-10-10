import { error, fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { archiveProject, renameProject, setProjectBrand } from '$lib/server/repos/projects';
import { findBrand, listOrgBrands } from '$lib/server/repos/brands';
import type { Db } from '$lib/server/db/client';
import { ENTRY_DEPS, homePathFor } from '$lib/server/tenancy/entry';
import { modeOf, ProjectMode } from '$lib/project-mode';
import { UNCENSORED_LOCK_TEXT, UncensoredLock, uncensoredSectionVisible } from '$lib/uncensored-lock';
import { verifyUserAge } from '$lib/server/uncensored-workspace/workspace';
import { SWITCH_REFUSAL_TEXT, switchProjectMode } from '$lib/server/uncensored-workspace/mode-switch';
import { appAccountStore, readAppAccount } from '$lib/server/repos/app-accounts';

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const CHECKED = 'on';

function refusalText(error: string): string {
  return SWITCH_REFUSAL_TEXT[error] ?? UNCENSORED_LOCK_TEXT[error as UncensoredLock] ?? error;
}

async function userIdOf(event: RequestEvent): Promise<string> {
  const { user } = await event.locals.safeGetSession();
  if (!user) {
    throw redirect(303, '/login');
  }
  return user.id;
}

type OwnedProject = { db: Db; orgId: string; projectId: string; name: string };

async function ownedProject(event: RequestEvent): Promise<OwnedProject> {
  const db = await event.locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }

  const projectId = event.params.projectId ?? '';
  const { data } = await db.from('projects').select('org_id, name').eq('id', projectId).is('archived_at', null).maybeSingle();
  const row = data as { org_id: string; name: string } | null;
  if (!row) {
    throw error(404, 'Project not found');
  }

  return { db, orgId: row.org_id, projectId, name: row.name };
}

function returnPathWithin(projectId: string, raw: FormDataEntryValue | null): string | null {
  const path = String(raw ?? '');
  return path.startsWith(`/p/${projectId}/`) ? path : null;
}

export const load: PageServerLoad = async ({ parent, locals }) => {
  const { project, org, brand, uncensored } = await parent();
  const db = await locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }

  const orgBrands = await listOrgBrands(db, org.id);
  return {
    project: { id: project.id, name: project.name, mode: modeOf(project.mode) },
    uncensored: { lock: uncensored.lock, visible: uncensoredSectionVisible(uncensored.lock), text: UNCENSORED_LOCK_TEXT[uncensored.lock as UncensoredLock] },
    linkedBrand: brand ? { id: brand.id, name: brand.name } : null,
    orgBrands: orgBrands.map((b) => ({ id: b.id, name: b.name })),
    appAccount: await readAppAccount(db, { orgId: org.id, projectId: project.id })
  };
};

export const actions: Actions = {
  setMode: async (event) => {
    const { db, orgId, projectId } = await ownedProject(event);
    const userId = await userIdOf(event);
    const fd = await event.request.formData();
    const to = modeOf(fd.get('mode'));
    if (to === ProjectMode.Uncensored && fd.get('acknowledge') !== CHECKED) {
      return fail(HTTP_BAD_REQUEST, { error: 'acknowledgment_required' });
    }

    const out = await switchProjectMode(db, { orgId, userId, projectId, to });
    return out.ok ? { switched: true } : fail(HTTP_FORBIDDEN, { error: refusalText(out.error) });
  },

  verifyAge: async (event) => {
    const { db, orgId, projectId } = await ownedProject(event);
    const userId = await userIdOf(event);
    const returnUrl = new URL(`/p/${projectId}/uncensored/verified`, event.url.origin).href;
    const out = await verifyUserAge(db, { orgId, userId, returnUrl });
    if ('redirect' in out) {
      throw redirect(303, out.redirect);
    }
    return out.ok ? { verified: true } : fail(HTTP_FORBIDDEN, { error: refusalText(out.error) });
  },

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

  forgetAppAccount: async (event) => {
    const { db, orgId, projectId } = await ownedProject(event);
    await appAccountStore(db, { orgId, projectId, actor: { kind: 'user', id: await userIdOf(event) } }).forget();
    return { forgotten: true };
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
    const { user } = await event.locals.safeGetSession();
    if (!user) {
      throw redirect(303, '/login');
    }
    throw redirect(303, await homePathFor(db, ENTRY_DEPS, user, orgId));
  }
};
