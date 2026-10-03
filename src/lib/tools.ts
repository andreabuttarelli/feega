export enum ToolStatus {
  Available = 'available',
  Beta = 'beta',
  ComingSoon = 'coming_soon'
}

export type ToolIcon = 'camera' | 'clapperboard';

export type Tool = {
  id: string;
  name: string;
  description: string;
  icon: ToolIcon;
  route: string | null;
  status: ToolStatus;
};

export const TOOLS: readonly Tool[] = [
  {
    id: 'studio',
    name: 'Photo studio',
    description: 'Consistent catalogue photos for many products at once.',
    icon: 'camera',
    route: '/app/studio',
    status: ToolStatus.Beta
  },
  {
    id: 'motion',
    name: 'Motion editor',
    description: 'Short videos from titles, media and 3D, edited with an agent.',
    icon: 'clapperboard',
    route: '/app/motion',
    status: ToolStatus.Beta
  }
];

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
