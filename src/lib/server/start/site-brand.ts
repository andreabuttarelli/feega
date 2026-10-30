import type { Db } from '$lib/server/db/client';
import { paletteSchema, voiceSchema } from '$lib/brand-kit';
import { startHost } from '$lib/start-url';
import type { SiteKit } from './brand-from-site';

const BRAND_COLUMNS = 'id, name, website, short_description, palette, voice, logo_url, content';

type BrandRow = { id: string; name: string; website: string | null; short_description: string | null; palette: unknown; voice: unknown; logo_url: string | null; content: string | null };

function sameHost(website: string | null, host: string): boolean {
  return Boolean(website && URL.canParse(website) && startHost(website) === host);
}

function kitOf(row: BrandRow, fonts: string[]): SiteKit {
  const palette = paletteSchema.safeParse(row.palette);
  const voice = voiceSchema.safeParse(row.voice);
  return {
    name: row.name,
    website: row.website ?? '',
    shortDescription: row.short_description,
    palette: palette.success ? palette.data : [],
    fonts,
    logoUrl: row.logo_url,
    voice: voice.success ? voice.data : {},
    content: row.content ?? ''
  };
}

export async function findSiteBrand(db: Db, orgId: string, host: string): Promise<{ id: string; kit: SiteKit } | null> {
  const { data } = await db.from('brands').select(BRAND_COLUMNS).eq('org_id', orgId).not('website', 'is', null);
  const row = ((data ?? []) as BrandRow[]).find((b) => sameHost(b.website, host));
  if (!row) {
    return null;
  }
  const { data: fonts } = await db.from('brand_fonts').select('google_family').eq('brand_id', row.id);
  return { id: row.id, kit: kitOf(row, (fonts ?? []).map((f) => f.google_family).filter((f): f is string => Boolean(f))) };
}
