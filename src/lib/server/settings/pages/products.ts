import type { BrandEvent } from '../event';

const PRODUCT_COLUMNS = 'id, title, price, currency, images, available, store_url, platform';

export const load = async ({ parent, locals: { supabase } }: BrandEvent) => {
  const { brand } = await parent();

  const { data } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('brand_id', brand.id)
    .order('title', { ascending: true });

  return { products: data ?? [] };
};
