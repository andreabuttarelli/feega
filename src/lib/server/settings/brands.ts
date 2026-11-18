import { fail, redirect } from '@sveltejs/kit';
import type { SharedActions, SharedEvent } from './event';
import { createOrgBrand, listOrgBrands } from '$lib/server/repos/brands';
import { brandSettingsHref } from '$lib/components/settings/platforms';
import { signedInDb } from '$lib/server/dashboard/app-shell';

const HTTP_BAD_REQUEST = 400;
const FIRST_SECTION = 'brand';

export const load = async (event: SharedEvent) => {
  const { org } = await event.parent();
  const { db } = await signedInDb(event);
  return { brands: await listOrgBrands(db, org.id) };
};

export const actions: SharedActions = {
  createBrand: async (event) => {
    const { org } = await event.parent();
    const name = String((await event.request.formData()).get('name') ?? '').trim();
    if (!name) {
      return fail(HTTP_BAD_REQUEST, { error: 'name_required' });
    }

    const { db } = await signedInDb(event);
    let brandId: string;
    try {
      brandId = await createOrgBrand(db, { orgId: org.id, name });
    } catch (e) {
      return fail(HTTP_BAD_REQUEST, { error: e instanceof Error ? e.message : 'Could not create the brand' });
    }
    throw redirect(303, brandSettingsHref(brandId, FIRST_SECTION));
  }
};
