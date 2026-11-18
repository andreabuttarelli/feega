import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BrandActions, BrandEvent } from '../event';
import { readUploadImage } from '$lib/server/raster-image';
import { AssetSize, canvasAssetUrl } from '$lib/canvas/asset-url';
import {
  FONT_ROLES,
  LOGO_VARIANTS,
  fontsFromForm,
  kitFromForm,
  kitToForm,
  logosSchema,
  paletteSchema,
  setLogoVariant,
  voiceSchema,
  type FontRole,
  type LogoVariant,
  type Logos
} from '$lib/brand-kit';

const BAD_REQUEST = 400;
const MAX_LOGO_BYTES = 4_000_000;
const RECENT_ASSETS = 48;
const LOGO_BUCKET = 'media';

const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

type Scope = { orgId: string; brandId: string };
type FontPick = { google_family: string | null; org_font_id: string | null };

export type BrandKitView = {
  fields: ReturnType<typeof kitToForm>;
  logos: Logos;
  fonts: Record<FontRole, FontPick | null>;
  orgFonts: Array<{ id: string; family: string }>;
  assets: Array<{ id: string; approved: boolean; thumb: string | null }>;
};

async function orgFontsOf(supabase: SupabaseClient, orgId: string): Promise<Array<{ id: string; family: string }>> {
  const { data, error } = await supabase.from('org_fonts').select('id, family').eq('org_id', orgId);
  return error ? [] : (data ?? []);
}

async function firstCanvasPerProject(supabase: SupabaseClient, projectIds: Array<string | null>): Promise<Map<string, string>> {
  const ids = [...new Set(projectIds.filter((id): id is string => id !== null))];
  if (!ids.length) {
    return new Map();
  }
  const { data } = await supabase.from('canvases').select('id, project_id').in('project_id', ids);
  const first = new Map<string, string>();
  for (const row of data ?? []) {
    if (!first.has(row.project_id)) {
      first.set(row.project_id, row.id);
    }
  }
  return first;
}

export async function loadKit(supabase: SupabaseClient, scope: Scope): Promise<BrandKitView> {
  const [brandRes, fontsRes, assetsRes, orgFonts] = await Promise.all([
    supabase.from('brands').select('palette, voice, logos').eq('id', scope.brandId).maybeSingle(),
    supabase.from('brand_fonts').select('role, google_family, org_font_id').eq('brand_id', scope.brandId),
    supabase.from('assets').select('id, brand_id, approved_at, project_id').eq('org_id', scope.orgId).eq('type', 'image').order('created_at', { ascending: false }).limit(RECENT_ASSETS),
    orgFontsOf(supabase, scope.orgId)
  ]);

  const brand = brandRes.data ?? { palette: [], voice: {}, logos: [] };
  const palette = paletteSchema.safeParse(brand.palette);
  const voice = voiceSchema.safeParse(brand.voice);
  const logos = logosSchema.safeParse(brand.logos);

  const fonts = Object.fromEntries(FONT_ROLES.map((role) => [role, null])) as Record<FontRole, FontPick | null>;
  for (const row of fontsRes.data ?? []) {
    fonts[row.role as FontRole] = { google_family: row.google_family, org_font_id: row.org_font_id };
  }

  const assetRows = assetsRes.data ?? [];
  const canvasOf = await firstCanvasPerProject(supabase, assetRows.map((a) => a.project_id));

  return {
    fields: kitToForm({ palette: palette.success ? palette.data : [], voice: voice.success ? voice.data : {} }),
    logos: logos.success ? logos.data : [],
    fonts,
    orgFonts,
    assets: assetRows.map((a) => ({
      id: a.id,
      approved: a.brand_id === scope.brandId && Boolean(a.approved_at),
      thumb: a.project_id && canvasOf.has(a.project_id) ? canvasAssetUrl(a.project_id, canvasOf.get(a.project_id)!, a.id, AssetSize.Thumb) : null
    }))
  };
}

async function brandScope({ parent }: BrandEvent): Promise<{ brandId: string; orgId: string }> {
  const { brand } = await parent();
  return { brandId: brand.id, orgId: brand.org_id };
}

async function currentLogos(supabase: SupabaseClient, brandId: string): Promise<Logos> {
  const { data } = await supabase.from('brands').select('logos').eq('id', brandId).maybeSingle();
  const parsed = logosSchema.safeParse(data?.logos ?? []);
  return parsed.success ? parsed.data : [];
}

function variantOf(fd: FormData): LogoVariant | null {
  const value = String(fd.get('variant') ?? '');
  return (LOGO_VARIANTS as readonly string[]).includes(value) ? (value as LogoVariant) : null;
}

export async function writeLogos(supabase: SupabaseClient, brandId: string, variant: LogoVariant, url: string | null) {
  const logos = setLogoVariant(await currentLogos(supabase, brandId), variant, url);
  const primary = variant === 'primary' ? { logo_url: url } : {};
  return supabase.from('brands').update({ logos, ...primary, updated_at: new Date().toISOString() }).eq('id', brandId);
}

export const kitActions = {
  saveKit: async (event) => {
    const { request, locals: { supabase } } = event;
    const scope = await brandScope(event);

    const kit = kitFromForm(await request.formData());
    if (!kit.ok) return fail(BAD_REQUEST, { error: kit.error });

    const { error } = await supabase
      .from('brands')
      .update({ palette: kit.palette, voice: kit.voice, updated_at: new Date().toISOString() })
      .eq('id', scope.brandId);
    if (error) return fail(BAD_REQUEST, { error: error.message });
    return { saved: true };
  },

  saveFonts: async (event) => {
    const { request, locals: { supabase } } = event;
    const scope = await brandScope(event);

    const choices = fontsFromForm(await request.formData());
    const chosen = choices.filter((c) => c.org_font_id || c.google_family);
    const cleared = choices.filter((c) => !c.org_font_id && !c.google_family).map((c) => c.role);

    if (chosen.length) {
      const rows = chosen.map((c) => ({ org_id: scope.orgId, brand_id: scope.brandId, ...c }));
      const { error } = await supabase.from('brand_fonts').upsert(rows, { onConflict: 'brand_id,role' });
      if (error) return fail(BAD_REQUEST, { error: error.message });
    }
    if (cleared.length) {
      const { error } = await supabase.from('brand_fonts').delete().eq('brand_id', scope.brandId).in('role', cleared);
      if (error) return fail(BAD_REQUEST, { error: error.message });
    }
    return { saved: true };
  },

  uploadLogoVariant: async (event) => {
    const { request, locals: { supabase } } = event;
    const scope = await brandScope(event);

    const fd = await request.formData();
    const variant = variantOf(fd);
    const file = fd.get('file');
    if (!variant) return fail(BAD_REQUEST, { error: 'Unknown logo variant' });
    if (!(file instanceof File) || file.size === 0) return fail(BAD_REQUEST, { error: 'No file' });

    const img = await readUploadImage(file, { maxOutBytes: MAX_LOGO_BYTES });
    if (!img.ok) return fail(BAD_REQUEST, { error: 'Not an image' });

    const path = `${scope.brandId}/logo-${variant}-${crypto.randomUUID()}.${EXTENSION[img.mime] ?? 'jpg'}`;
    const up = await supabase.storage.from(LOGO_BUCKET).upload(path, img.bytes, { contentType: img.mime, upsert: false });
    if (up.error) return fail(BAD_REQUEST, { error: up.error.message });
    const url = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;

    const { error } = await writeLogos(supabase, scope.brandId, variant, url);
    if (error) return fail(BAD_REQUEST, { error: error.message });
    return { saved: true };
  },

  removeLogoVariant: async (event) => {
    const { request, locals: { supabase } } = event;
    const scope = await brandScope(event);

    const variant = variantOf(await request.formData());
    if (!variant) return fail(BAD_REQUEST, { error: 'Unknown logo variant' });

    const { error } = await writeLogos(supabase, scope.brandId, variant, null);
    if (error) return fail(BAD_REQUEST, { error: error.message });
    return { saved: true };
  },

  toggleApproved: async (event) => {
    const { request, locals: { supabase } } = event;
    const scope = await brandScope(event);

    const fd = await request.formData();
    const assetId = String(fd.get('assetId') ?? '');
    const approved = fd.get('approved') === 'true';
    const patch = approved ? { brand_id: scope.brandId, approved_at: new Date().toISOString() } : { brand_id: null, approved_at: null };

    const { error } = await supabase.from('assets').update(patch).eq('org_id', scope.orgId).eq('id', assetId);
    if (error) return fail(BAD_REQUEST, { error: error.message });
    return { saved: true };
  }
} satisfies BrandActions;
