import { json } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import { findOrCreateImportedAsset } from '$lib/server/repos/assets';
import { tallyBrandStatus } from '$lib/canvas/brand-switcher';
import type { RequestHandler } from './$types';

const BRAND_COLUMNS = 'id, name, slug, logo_url, short_description, content';
const NO_STATUS = { scheduled: 0, accounts: 0, accountsDown: 0 };

export const GET: RequestHandler = async ({ params, locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) return json({ error: 'unauthenticated' }, { status: 401 });

  const db = await locals.db();
  if (!db) {
    return json({ error: 'no_client' }, { status: 500 });
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findReachableProject(db, { projectId: params.projectId ?? '', memberships, userId: user.id });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: 404 });
  }

  const { orgId } = found;

  const [brandsRes, postsRes, accountsRes, pinsRes] = await Promise.all([
    db.from('brands').select(BRAND_COLUMNS).eq('org_id', orgId).order('name', { ascending: true }),
    db.from('posts').select('brand_id, status, planned_for').eq('org_id', orgId).eq('status', 'ready'),
    db.from('social_accounts').select('brand_id, status').eq('org_id', orgId),
    db.from('brand_pins').select('brand_id').eq('org_id', orgId).eq('user_id', user.id).order('created_at', { ascending: true })
  ]);

  if (brandsRes.error || postsRes.error || accountsRes.error || pinsRes.error) {
    return json({ error: 'query_failed' }, { status: 500 });
  }

  const status = tallyBrandStatus({ posts: postsRes.data ?? [], accounts: accountsRes.data ?? [] }, new Date());

  const brands = await Promise.all(
    (brandsRes.data ?? []).map(async (row) => {
      const logoAsset = row.logo_url
        ? await findOrCreateImportedAsset(db, { orgId, type: 'image', url: row.logo_url })
        : null;

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        logoUrl: row.logo_url,
        logoAssetId: logoAsset?.id ?? null,
        shortDescription: row.short_description,
        content: row.content,
        ...(status.get(row.id) ?? NO_STATUS)
      };
    })
  );

  return json({ brands, projectBrandId: found.project.brandId ?? null, pinned: (pinsRes.data ?? []).map((p) => p.brand_id) });
};
