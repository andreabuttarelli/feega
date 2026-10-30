export const CANVAS_DRAG_COMPONENT = 'application/x-feega-component';

export type ComponentDrag = { frameId: string; compId: string };

export const serializeComponentDrag = (drag: ComponentDrag): string => JSON.stringify(drag);

export function parseComponentDrag(raw: string): ComponentDrag | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ComponentDrag>;
    return typeof parsed.frameId === 'string' && typeof parsed.compId === 'string' ? { frameId: parsed.frameId, compId: parsed.compId } : null;
  } catch {
    return null;
  }
}

const CLIP_PREFIX = 'feega-component:';

export const componentClipText = (drag: ComponentDrag): string => `${CLIP_PREFIX}${serializeComponentDrag(drag)}`;

export const parseComponentClip = (text: string): ComponentDrag | null =>
  text.startsWith(CLIP_PREFIX) ? parseComponentDrag(text.slice(CLIP_PREFIX.length)) : null;
