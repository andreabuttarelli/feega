import { describe, expect, it } from 'vitest';
import { TOOLS, toolForCampaign, toolHref } from './tools';

describe('the tools registry', () => {
  it('lists the video upscaler at /app/upscale', () => {
    const upscaler = TOOLS.find((t) => t.id === 'upscale');
    expect(upscaler).toMatchObject({ name: 'AI Video Upscaler', route: '/app/upscale' });
    expect(toolHref(upscaler!, 'p1')).toBe('/app/upscale?project=p1');
  });

  it('the upscaler landing campaign is served by the upscaler tool', () => {
    expect(toolForCampaign('ai-video-upscaler')?.id).toBe('upscale');
  });

  it('a campaign no tool serves has no tool', () => {
    expect(toolForCampaign('anime-video-generator')).toBeNull();
  });
});
