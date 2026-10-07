import { describe, expect, it } from 'vitest';
import { CAMPAIGN_TEMPLATES, campaignOf, templateIdForCampaign } from './campaigns';
import { templateById } from '$lib/canvas/templates';

const LANDING_SLUGS = [
  'ai-video-upscaler',
  '3d-animation-maker',
  'ai-commercial-maker',
  'paper-cutout-animation',
  'claymation-ai',
  '80s-retro-video',
  'anime-video-generator',
  'ai-video-styles',
  'spotify-canvas-maker',
  'ai-video-generator',
  'ai-node-editor'
];

describe('campaign → template', () => {
  it('every landing slug maps to an existing template', () => {
    for (const slug of LANDING_SLUGS) {
      const campaign = campaignOf(slug);
      expect(campaign, slug).not.toBeNull();
      expect(templateById(templateIdForCampaign(campaign!)), slug).toBeDefined();
    }
  });

  it('the table holds exactly the landing slugs', () => {
    expect(Object.keys(CAMPAIGN_TEMPLATES).sort()).toEqual([...LANDING_SLUGS].sort());
  });

  it('an unknown or missing campaign is not a campaign', () => {
    expect(campaignOf('spring-sale')).toBeNull();
    expect(campaignOf(null)).toBeNull();
    expect(campaignOf('__proto__')).toBeNull();
  });

  it('anime landing gets the anime template', () => {
    expect(templateIdForCampaign(campaignOf('anime-video-generator')!)).toBe('anime-video');
  });

  it('the upscaler landing opens an upscale-ready canvas, not a generation template', () => {
    const template = templateById(templateIdForCampaign(campaignOf('ai-video-upscaler')!))!;
    expect(template.nodes.some((n) => n.data.model === 'black-forest-labs/flux-video-upscale')).toBe(true);
  });
});
