import { everyClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { BrandKind } from '$lib/motion/script';
import { Capability, MODE_ALLOWS, modeAllows, type ProjectMode } from '$lib/project-mode';

export enum PublishRefusal {
  Uncensored = 'uncensored_not_publishable',
  RealBrandScript = 'real_brand_not_publishable',
  BrandLogo = 'brand_logo_not_publishable',
  SiteMaterial = 'site_material_not_publishable',
  Empty = 'empty_video'
}

export type PublishFacts = {
  mode: ProjectMode;
  hasBrand: boolean;
  doc: MotionDoc;
  siteAssetIds: ReadonlySet<string>;
};

type Rule = { refusal: PublishRefusal; message: string; applies: (facts: PublishFacts) => boolean };

const LOGO_COMPONENTS = new Set(['Logo', 'Logo3D']);

const isLogo = (clip: MotionClip) => LOGO_COMPONENTS.has(clip.component);
const usesAsset = (clip: MotionClip, id: string) => JSON.stringify([clip.props, clip.mask, clip.maskStack]).includes(JSON.stringify(id));

const RULES: readonly Rule[] = [
  {
    refusal: PublishRefusal.Uncensored,
    message: 'Videos from an uncensored project never go to the gallery.',
    applies: (f) => !MODE_ALLOWS[f.mode].has(Capability.Share)
  },
  {
    refusal: PublishRefusal.Empty,
    message: 'There is nothing in this video yet.',
    applies: (f) => everyClip(f.doc).length === 0
  },
  {
    refusal: PublishRefusal.RealBrandScript,
    message: 'This video tells the story of a real brand: only invented brands and generic videos go to the gallery.',
    applies: (f) => f.doc.script?.brand === BrandKind.Real
  },
  {
    refusal: PublishRefusal.BrandLogo,
    message: "This video shows the project brand's logo: remove it, or use an invented logo, before publishing.",
    applies: (f) => f.hasBrand && everyClip(f.doc).some((c) => isLogo(c) && !c.props.assetId)
  },
  {
    refusal: PublishRefusal.SiteMaterial,
    message: 'This video uses logos or pictures imported from a website: they belong to that site, so it cannot be published.',
    applies: (f) => [...f.siteAssetIds].some((id) => everyClip(f.doc).some((c) => usesAsset(c, id)))
  }
];

export function publishRefusal(facts: PublishFacts): { refusal: PublishRefusal; message: string } | null {
  const rule = RULES.find((r) => r.applies(facts));
  return rule ? { refusal: rule.refusal, message: rule.message } : null;
}

export function embedRefusal(mode: ProjectMode): { refusal: PublishRefusal; message: string } | null {
  return modeAllows(mode, Capability.Share) ? null : { refusal: PublishRefusal.Uncensored, message: 'Videos from an uncensored project are never published as an embed.' };
}
