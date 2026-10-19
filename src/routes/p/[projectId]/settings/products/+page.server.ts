import type { PageServerLoad } from './$types';
import { load as projectShell } from '$lib/server/projects/project-shell';

const PRODUCT_COLUMNS = 'id, title, price, currency, images, available, store_url, platform';

export const load: PageServerLoad = async (event) => {
  const { locals: { supabase } } = event;
  const { brand } = await projectShell(event);
  if (!brand) {
    return { products: [] };
  }

  const { data } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('brand_id', brand.id)
    .order('title', { ascending: true });

  return { products: data ?? [] };
};
