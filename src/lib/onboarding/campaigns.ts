export const WELCOME_PARAM = 'welcome';

export const CAMPAIGN_TEMPLATES = {
  'ai-video-upscaler': 'video-upscale',
  '3d-animation-maker': '3d-animation',
  'ai-commercial-maker': 'ai-commercial',
  'paper-cutout-animation': 'paper-cutout',
  'claymation-ai': 'claymation-video',
  '80s-retro-video': 'retro-vhs',
  'anime-video-generator': 'anime-video',
  'ai-video-styles': 'style-transfer',
  'spotify-canvas-maker': 'spotify-canvas',
  'ai-video-generator': 'text-to-video',
  'ai-node-editor': 'brief-to-reel'
} as const;

export type Campaign = keyof typeof CAMPAIGN_TEMPLATES;

export function campaignOf(value: string | null | undefined): Campaign | null {
  if (!value || !Object.hasOwn(CAMPAIGN_TEMPLATES, value)) {
    return null;
  }
  return value as Campaign;
}

export function templateIdForCampaign(campaign: Campaign): string {
  return CAMPAIGN_TEMPLATES[campaign];
}

export const TEMPLATE_AUTO_INSERTED = 'template_auto_inserted';
