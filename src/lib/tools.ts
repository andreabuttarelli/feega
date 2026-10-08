import type { Campaign } from '$lib/onboarding/campaigns';

export enum ToolStatus {
  Available = 'available',
  Beta = 'beta',
  ComingSoon = 'coming_soon'
}

export enum ToolRole {
  Lead = 'lead',
  Support = 'support'
}

export type ToolIcon = 'camera' | 'clapperboard' | 'upscale' | 'orbit';

export type Tool = {
  id: string;
  name: string;
  description: string;
  icon: ToolIcon;
  route: string | null;
  status: ToolStatus;
  role: ToolRole;
  campaign?: Campaign;
};

export const TOOLS: readonly Tool[] = [
  {
    id: 'studio',
    name: 'Photo studio',
    description: 'Product photos for your store from one picture, in three steps.',
    icon: 'camera',
    route: '/app/studio',
    status: ToolStatus.Beta,
    role: ToolRole.Support
  },
  {
    id: 'motion',
    name: 'Motion editor',
    description: 'Short videos from titles, media and 3D, edited with an agent.',
    icon: 'clapperboard',
    route: '/app/motion',
    status: ToolStatus.Beta,
    role: ToolRole.Lead
  },
  {
    id: 'compose',
    name: 'Compositions',
    description: 'Many images and videos in a looping 3D layout, from a template.',
    icon: 'orbit',
    route: '/app/compose',
    status: ToolStatus.Beta,
    role: ToolRole.Support
  },
  {
    id: 'upscale',
    name: 'AI Video Upscaler',
    description: 'Sharpen a clip to 2× or 4K, with a before/after preview.',
    icon: 'upscale',
    route: '/app/upscale',
    status: ToolStatus.Beta,
    role: ToolRole.Support,
    campaign: 'ai-video-upscaler'
  }
];

export const SUPPORT_TOOLS: readonly Tool[] = TOOLS.filter((tool) => tool.role === ToolRole.Support);

export const TOOL_STATUS_LABEL: Record<ToolStatus, string | null> = {
  [ToolStatus.Available]: null,
  [ToolStatus.Beta]: 'Beta',
  [ToolStatus.ComingSoon]: 'Coming soon'
};

export function toolHref(tool: Tool, projectId: string | null): string | null {
  if (!tool.route) {
    return null;
  }
  return projectId ? `${tool.route}?project=${projectId}` : tool.route;
}

export function toolForCampaign(campaign: Campaign): Tool | null {
  return TOOLS.find((tool) => tool.campaign === campaign) ?? null;
}
