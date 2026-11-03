import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { ComponentGroup } from '$lib/motion/canvas-components';
import type { ComponentDrag } from './component-drag';

export type ProjectComponent = ComponentGroup & { thumb: string | null; frameName: string; revision: number };
export type CanvasComponents = { canvasId: string; canvasName: string; components: ProjectComponent[] };

const base = (projectId: string) => `/api/v1/projects/${encodeURIComponent(projectId)}/components`;

export async function fetchProjectComponents(projectId: string): Promise<CanvasComponents[]> {
  const res = await fetch(base(projectId)).catch(() => null);
  return res?.ok ? ((await res.json()) as { canvases: CanvasComponents[] }).canvases : [];
}

export async function fetchComponentSource(projectId: string, drag: ComponentDrag): Promise<MotionDoc | null> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(drag.frameId)}/${encodeURIComponent(drag.compId)}`).catch(() => null);
  return res?.ok ? ((await res.json()) as { source: MotionDoc }).source : null;
}

export function matchingComponents(canvases: readonly CanvasComponents[], query: string): CanvasComponents[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...canvases];
  }
  return canvases.flatMap((canvas) => {
    const components = canvas.components.filter((c) => c.name.toLowerCase().includes(q) || canvas.canvasName.toLowerCase().includes(q));
    return components.length ? [{ ...canvas, components }] : [];
  });
}

const tilesOf = (component: ProjectComponent): number => Math.max(1, component.variants.length);

export const tileCount = (canvases: readonly CanvasComponents[]): number => canvases.reduce((sum, canvas) => sum + canvas.components.reduce((n, c) => n + tilesOf(c), 0), 0);

export function firstTiles(canvases: readonly CanvasComponents[], limit: number): CanvasComponents[] {
  let left = limit;
  return canvases.flatMap((canvas) => {
    const components = canvas.components.filter((component) => {
      const fits = left > 0;
      left -= fits ? tilesOf(component) : 0;
      return fits;
    });
    return components.length ? [{ ...canvas, components }] : [];
  });
}

export type MainLocation = { canvasId: string; label: string };

export function mainLocation(canvases: readonly CanvasComponents[], frameId: string): MainLocation | null {
  for (const canvas of canvases) {
    const held = canvas.components.find((c) => c.frameId === frameId);
    if (held) {
      return { canvasId: canvas.canvasId, label: `${canvas.canvasName} › ${held.frameName}` };
    }
  }
  return null;
}
