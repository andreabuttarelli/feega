import type { Db } from '$lib/server/db/client';
import { analyzeWizardSite, createBrandFromWizard } from '$lib/server/brand-wizard';
import { setProjectBrand } from '$lib/server/repos/projects';
import { frameStore } from '$lib/server/motion/move-element';
import { pageAssets } from '$lib/server/url-import/canvas-import';
import { LOGO_VARIANTS, FONT_ROLES } from '$lib/brand-kit';
import { findSiteBrand } from './site-brand';
import { brandKitDoc } from './brand-kit-frame';
import type { BrandSitePorts, SiteKit } from './brand-from-site';

const PRIMARY_LOGO = LOGO_VARIANTS[0];

export function liveBrandPorts(db: Db, user: { userId: string }): BrandSitePorts {
  return {
    findByDomain: (orgId, host) => findSiteBrand(db, orgId, host),

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
