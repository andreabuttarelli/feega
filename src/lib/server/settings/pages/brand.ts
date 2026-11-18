import { error, fail } from '@sveltejs/kit';
import type { BrandActions, BrandEvent } from '../event';
import { readUploadImage } from '$lib/server/raster-image';
import { kitActions, loadKit, writeLogos } from './brand-kit';

const BRAND_COLUMNS = 'id, name, slug, logo_url, website, short_description, content';

export type BrandSettings = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  shortDescription: string | null;
  content: string | null;
};

function toBrandSettings(row: {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  short_description: string | null;
  content: string | null;
}): BrandSettings {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    website: row.website,
    shortDescription: row.short_description,
    content: row.content
  };
}

export const load = async ({ parent, locals: { supabase } }: BrandEvent) => {
  const { org, brand } = await parent();

  const { data, error: dbError } = await supabase.from('brands').select(BRAND_COLUMNS).eq('id', brand.id).maybeSingle();
  if (dbError) {
    throw error(500, dbError.message);
  }
  if (!data) {
    throw error(404, 'brand not found');
  }

  return {
    brand: toBrandSettings(data),
    kit: await loadKit(supabase, { orgId: org.id, brandId: data.id })
  };
};

export const actions: BrandActions = {
  ...kitActions,
  update: async ({ request, parent, locals: { supabase } }) => {
    const { brand } = await parent();
    const brandId = brand.id;

    const fd = await request.formData();
    const name = String(fd.get('name') ?? '').trim();
    if (!name) return fail(400, { error: 'Name is required' });

    const website = String(fd.get('website') ?? '').trim();
    const normalizedWebsite = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null;

    const patch = {
      name,
      website: normalizedWebsite,
      short_description: String(fd.get('short_description') ?? '').trim() || null,
      content: String(fd.get('content') ?? '').trim() || null,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase.from('brands').update(patch).eq('id', brandId);
    if (updateError) return fail(400, { error: updateError.message });
    return { saved: true };
  },

  uploadLogo: async ({ request, parent, locals: { supabase } }) => {
    const { brand } = await parent();
    const brandId = brand.id;

    const fd = await request.formData();
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'No file' });

    const img = await readUploadImage(file, { maxOutBytes: 4_000_000 });
    if (!img.ok) {
      return fail(400, {
        error:
          img.error === 'too_large' ? 'Too large' : img.error === 'not_image' ? 'Not an image' : 'Could not convert image'
      });
    }

    const ext = img.mime === 'image/png' ? 'png' : img.mime === 'image/gif' ? 'gif' : img.mime === 'image/webp' ? 'webp' : 'jpg';
    const path = `${brandId}/logo-${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from('media').upload(path, img.bytes, { contentType: img.mime, upsert: false });
    if (up.error) return fail(400, { error: up.error.message });
    const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;

    const { error: updateError } = await writeLogos(supabase, brandId, 'primary', url);
    if (updateError) return fail(400, { error: updateError.message });
    return { saved: true };
  },

  removeLogo: async ({ parent, locals: { supabase } }) => {
    const { brand } = await parent();
    const brandId = brand.id;

    const { error: updateError } = await writeLogos(supabase, brandId, 'primary', null);
    if (updateError) return fail(400, { error: updateError.message });
    return { saved: true };
  }
};
