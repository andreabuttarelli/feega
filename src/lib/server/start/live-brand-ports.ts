import type { Db } from '$lib/server/db/client';
import { analyzeWizardSite, createBrandFromWizard } from '$lib/server/brand-wizard';
import { setProjectBrand } from '$lib/server/repos/projects';
import { frameStore } from '$lib/server/motion/move-element';
import { pageAssets } from '$lib/server/url-import/canvas-import';
import { paletteSchema, voiceSchema, LOGO_VARIANTS, FONT_ROLES } from '$lib/brand-kit';
import { startHost } from '$lib/start-url';
import { brandKitDoc } from './brand-kit-frame';
import type { BrandSitePorts, SiteKit } from './brand-from-site';

const BRAND_COLUMNS = 'id, name, website, short_description, palette, voice, logo_url, content';
const PRIMARY_LOGO = LOGO_VARIANTS[0];

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

export function liveBrandPorts(db: Db, user: { userId: string }): BrandSitePorts {
  return {
    findByDomain: async (orgId, host) => {
      const { data } = await db.from('brands').select(BRAND_COLUMNS).eq('org_id', orgId).not('website', 'is', null);
      const row = ((data ?? []) as BrandRow[]).find((b) => sameHost(b.website, host));
      if (!row) {
        return null;
      }
      const { data: fonts } = await db.from('brand_fonts').select('google_family').eq('brand_id', row.id);
      return { id: row.id, kit: kitOf(row, (fonts ?? []).map((f) => f.google_family).filter((f): f is string => Boolean(f))) };
    },

    analyse: async (orgId, url) => (await analyzeWizardSite(orgId, url)).profile,

    createBrand: async (orgId, kit) => {
      const created = await createBrandFromWizard(db, {
        orgId,
        projectId: '',
        projectHasBrand: true,
        name: kit.name,
        website: kit.website,
        shortDescription: kit.shortDescription,
        content: kit.content,
        logoUrl: kit.logoUrl,
        products: [],
        productsPlatform: null,
        kit: { palette: kit.palette, voice: kit.voice, logos: kit.logoUrl ? [{ variant: PRIMARY_LOGO, url: kit.logoUrl }] : [] }
      });
      const fonts = kit.fonts.slice(0, FONT_ROLES.length).map((family, i) => ({ org_id: orgId, brand_id: created.id, role: FONT_ROLES[i], google_family: family }));
      if (fonts.length) {
        await db.from('brand_fonts').insert(fonts);
      }
      return created.id;
    },

    attach: (orgId, projectId, brandId) => setProjectBrand(db, { orgId, projectId, brandId }),

    placeKit: async (scope, kit, at) => {
      const logo = kit.logoUrl ? await pageAssets({ db, orgId: scope.orgId, userId: user.userId, projectId: scope.projectId }).importImage(kit.logoUrl).catch(() => null) : null;
      const store = frameStore(db, { orgId: scope.orgId, actor: { kind: 'user', id: user.userId }, projectId: scope.projectId });
      return store.create({ projectId: scope.projectId, canvasId: scope.canvasId, ...at }, brandKitDoc(kit, logo));
    }
  };
}
