import type { SupabaseClient } from '@supabase/supabase-js';
import { HOME_PATH } from '$lib/home-path';

/**
 * DA UN PROGETTO AL SUO BRAND, QUANDO LE PAGINE ANCORA CHIEDONO LO SLUG DEL BRAND.
 *
 * Le pagine che stanno sotto `/p/<projectId>/…` parlano di brand — un calendario, una libreria,
 * un sito sono del brand. Ma il tenant nell'URL è il progetto, e `projects.brand_id` è nullable.
 * Questo ponte risolve lo slug, e dice chiaramente «non c'è» invece di far cercare uno slug vuoto.
 */
export async function brandSlugOf(
  supabase: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('brand_id')
    .eq('id', projectId)
    .maybeSingle();

  const brandId = project?.brand_id;
  if (!brandId) {
    return null;
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('slug')
    .eq('id', brandId)
    .maybeSingle();

  return brand?.slug ?? null;
}

export async function brandIdOf(
  supabase: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('brand_id')
    .eq('id', projectId)
    .maybeSingle();

  return project?.brand_id ?? null;
}

/** Il verso opposto: dal brand al progetto che lo contiene, per un link che deve atterrare su
 *  `/p/<projectId>/…` conoscendo solo il brand (es. un URL coniato da una rotta API keyed by
 *  slug). Un brand senza progetto — nessuno vivo — non ha link: `null`. Con più d'uno, il più
 *  vecchio: è quello che possedeva già i contenuti di cui l'email/rotta sta parlando, mentre i
 *  progetti archiviati non sono una destinazione valida. */
export async function projectIdOfBrand(
  supabase: SupabaseClient,
  brandId: string
): Promise<string | null> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('brand_id', brandId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  return projects?.[0]?.id ?? null;
}

/**
 * Un link `/p/<projectId>/…` per un brand conosciuto solo per slug o id — quello che un'email
 * transazionale costruisce. Risolve il progetto UNA volta e lo antepone a `path`; senza un
 * progetto vivo il link non si può costruire, e un generico verso il bootstrap batte un 404
 * garantito.
 */
export async function appPathForBrand(
  supabase: SupabaseClient,
  brandId: string,
  path = ''
): Promise<string> {
  const projectId = await projectIdOfBrand(supabase, brandId);
  if (!projectId) {
    return HOME_PATH;
  }
  return `/p/${projectId}${path}`;
}

export function joinAppPath(appBasePath: string, path: string): string {
  return appBasePath === HOME_PATH ? HOME_PATH : `${appBasePath}${path}`;
}
