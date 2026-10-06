import type { ComponentId } from '../components';
import { boxOf, type Box } from '../layout';
import type { Extent } from '../shape/render';

type Placement = Parameters<typeof boxOf>[0] & { scale?: number; rotation?: number };
type Frame = { width: number; height: number };

const DEGREES = Math.PI / 180;

function placedExtent(extent: Extent, box: Box, p: Placement): Box {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const scale = p.scale ?? 1;
  const cos = Math.cos((p.rotation ?? 0) * DEGREES) * scale;
  const sin = Math.sin((p.rotation ?? 0) * DEGREES) * scale;
  const corners = [
    [extent.left, extent.top],
    [extent.right, extent.top],
    [extent.left, extent.bottom],
    [extent.right, extent.bottom]
  ].map(([x, y]) => {
    const dx = box.left + x - cx;
    const dy = box.top + y - cy;
    return [cx + cos * dx - sin * dy, cy + sin * dx + cos * dy];
  });
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

const AREA: Partial<Record<ComponentId, (p: Placement, frame: Frame, extent: Extent | null) => Box | null>> = {
  Shape: (p, frame, extent) => (extent ? placedExtent(extent, boxOf(p, frame), p) : null)
};

export function paintArea(component: ComponentId, p: Placement, frame: Frame, extent: Extent | null): Box | null {
  return AREA[component]?.(p, frame, extent) ?? null;
}
