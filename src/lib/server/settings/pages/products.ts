import type { SettingsEvent } from '../event';

const PRODUCT_COLUMNS = 'id, title, price, currency, images, available, store_url, platform';

export const load = async ({ parent, locals: { supabase } }: SettingsEvent) => {
  const { brand } = await parent();
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
