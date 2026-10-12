import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { MOCKUP_COMPONENT, MOCKUP_FONTS, MOCKUP_PROPS, MOCKUP_VAR_PREFIX, mockupComponent } from './component';

export const MOCKUP_TEMPLATE_ID = `${BUILTIN_PREFIX}saas-monitor`;
export const MOCKUP_CLIP = 'mockup';
export const MOCKUP_VARS = ['watermark', 'siteBrand', 'navItems', 'headline', 'subtext', 'primaryCta', 'secondaryCta', 'screenSource', 'screenAsset', 'accent', 'backgroundFrom', 'backgroundTo', 'grain', 'finish', 'tiltYaw', 'tiltPitch', 'drift', 'enterSeconds', 'scroll', 'leave'];

export const MOCKUP_KEY_FIELDS = ['watermark', 'headline', 'accent', 'screen_source', 'screen_asset'];

export const SAAS_MONITOR_TEMPLATE: TemplateEntry = {
  id: MOCKUP_TEMPLATE_ID,
  template: {
    name: 'SaaS monitor',
    description: 'A studio desktop monitor rises into a tilted pose over a violet gradient and a big background word; on its screen a website types its headline, hovers its button and scrolls to the product. Every part is a field or a runtime variable.',
    doc: customTemplateDoc({ name: 'saas-monitor', component: MOCKUP_COMPONENT, code: mockupComponent(), props: MOCKUP_PROPS, fonts: MOCKUP_FONTS, varPrefix: MOCKUP_VAR_PREFIX, vars: MOCKUP_VARS, clip: MOCKUP_CLIP, seconds: 12, fps: 30 })
  }
};
