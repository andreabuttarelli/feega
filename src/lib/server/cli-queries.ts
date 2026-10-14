/**
 * Shared query functions for CLI API endpoints.
 * These can also be reused by +page.server.ts files to avoid duplication.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Brand list ──────────────────────────────────────────────────────────

/** `onlyIds` scopes the list for API-key auth (service-role client, no RLS); null = RLS-scoped client. */
export async function getBrandsList(supabase: SupabaseClient, onlyIds: string[] | null = null) {
  if (onlyIds && !onlyIds.length) return [];
  let q = supabase
    .from('brands')
    .select('id, name, slug');
  if (onlyIds) q = q.in('id', onlyIds);
  const { data: brands, error } = await q.order('name');
  if (error) throw error;

  if (!brands?.length) return [];

  const ids = brands.map(b => b.id);
  const { data: posts, error: postsError } = await supabase
    .from('posts').select('brand_id').in('brand_id', ids).eq('status', 'pending_user');
  if (postsError) throw postsError;

  const pendingCounts = new Map<string, number>();
  for (const p of posts ?? []) pendingCounts.set(p.brand_id, (pendingCounts.get(p.brand_id) ?? 0) + 1);

  return brands.map(b => ({
    ...b,
    pendingCount: pendingCounts.get(b.id) ?? 0,
  }));
}

// ── Brand detail ────────────────────────────────────────────────────────

export async function getBrandDetail(supabase: SupabaseClient, brandId: string) {
  const [pendingRes, productsRes, accountsRes, brandRes] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId).eq('status', 'pending_user'),
    supabase.from('products').select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId),
    supabase.from('social_accounts').select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId),
    supabase.from('brands').select('logo_url')
      .eq('id', brandId).maybeSingle(),
  ]);
  for (const res of [pendingRes, productsRes, accountsRes, brandRes]) {
    if (res.error) throw res.error;
  }

  return {
    pendingCount: pendingRes.count ?? 0,
    productCount: productsRes.count ?? 0,
    accountCount: accountsRes.count ?? 0,
    logoUrl: brandRes.data?.logo_url ?? null,
  };
}
