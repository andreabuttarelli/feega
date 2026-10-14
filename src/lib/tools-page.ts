import { GALLERY_PATH } from '$lib/gallery/paths';
import { TOOLS, TOOL_STATUS_LABEL, toolHref, type ToolIcon } from '$lib/tools';

export type ToolEntry = { id: string; name: string; description: string; icon: ToolIcon | 'gallery'; href: string; badge: string | null };

const GALLERY: ToolEntry = { id: 'gallery', name: 'Gallery', description: 'Videos made with feega, ready to remix.', icon: 'gallery', href: GALLERY_PATH, badge: null };

export function toolEntries(projectId: string | null): ToolEntry[] {
  const tools = TOOLS.flatMap((tool) => {
    const href = toolHref(tool, projectId);
    return href ? [{ id: tool.id, name: tool.name, description: tool.description, icon: tool.icon, href, badge: TOOL_STATUS_LABEL[tool.status] }] : [];
  });
  return [...tools, GALLERY];
}
