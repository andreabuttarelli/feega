import type { BrandProfile } from '$lib/server/brand-analysis';
import { composeWizardContent } from '$lib/server/brand-wizard';
import { HEX, type Palette, type Voice } from '$lib/brand-kit';
import { startHost } from '$lib/start-url';

export enum BrandFromSite {
  Created = 'created',
  Reused = 'reused',
  Failed = 'failed'
}

export type SiteKit = {
  name: string;
  website: string;
  shortDescription: string | null;
  palette: Palette;
  fonts: string[];
  logoUrl: string | null;
  voice: Voice;
  content: string;
};

export type KitScope = { orgId: string; projectId: string; canvasId: string };

export type BrandSitePorts = {
  findByDomain: (orgId: string, host: string) => Promise<{ id: string; kit: SiteKit } | null>;
  analyse: (orgId: string, url: string) => Promise<BrandProfile>;
  createBrand: (orgId: string, kit: SiteKit) => Promise<string>;
  attach: (orgId: string, projectId: string, brandId: string) => Promise<void>;
  placeKit: (scope: KitScope, kit: SiteKit, at: { x: number; y: number }) => Promise<string | null>;
};

export type BrandSiteResult =
  | { outcome: BrandFromSite.Created | BrandFromSite.Reused; brandId: string; frameId: string | null }
  | { outcome: BrandFromSite.Failed; error: string };

const MAX_TONE = 500;
const MAX_FONTS = 3;
const MAX_SWATCHES = 8;

function webUrl(raw: string | undefined): string | null {
  return raw && URL.canParse(raw) && /^https?:/.test(raw) ? raw : null;
}

export function kitFromProfile(profile: BrandProfile, url: string): SiteKit {
  const colours = (profile.brand_colors ?? []).filter((c) => HEX.test(c)).slice(0, MAX_SWATCHES);
  return {
    name: profile.name?.trim() || startHost(url),
    website: url,
    shortDescription: profile.about?.trim() || null,
    palette: colours.map((hex) => ({ hex })),
    fonts: [...new Set((profile.fonts ?? []).map((f) => f.name.trim()).filter(Boolean))].slice(0, MAX_FONTS),
    logoUrl: webUrl(profile.logos?.[0]?.url),
    voice: profile.brand_style?.trim() ? { tone: profile.brand_style.trim().slice(0, MAX_TONE) } : {},
    content: composeWizardContent({
      target: profile.target_audience ?? '',
      colours,
      brandHandles: (profile.social_handles ?? []).map((h) => ({ platform: h.platform, handle: h.handle }))
    })
  };
}

async function brandFor(scope: KitScope, url: string, ports: BrandSitePorts): Promise<{ outcome: BrandFromSite.Created | BrandFromSite.Reused; brandId: string; kit: SiteKit }> {
  const known = await ports.findByDomain(scope.orgId, startHost(url));
  if (known) {
    return { outcome: BrandFromSite.Reused, brandId: known.id, kit: known.kit };
  }

  const kit = kitFromProfile(await ports.analyse(scope.orgId, url), url);
  return { outcome: BrandFromSite.Created, brandId: await ports.createBrand(scope.orgId, kit), kit };
}

export async function brandFromSite(scope: KitScope, url: string, at: { x: number; y: number }, ports: BrandSitePorts): Promise<BrandSiteResult> {
  const brand = await brandFor(scope, url, ports).catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));
  if ('error' in brand) {
    return { outcome: BrandFromSite.Failed, error: brand.error };
  }

  await ports.attach(scope.orgId, scope.projectId, brand.brandId);
  const frameId = await ports.placeKit(scope, brand.kit, at).catch(() => null);
  return { outcome: brand.outcome, brandId: brand.brandId, frameId };
}
