import type { AnimatedLayer } from '@feega/motion-core/motion/smart-animate/smart-animate';

export type PreviewSize = { width: number; height: number };
export type PreviewBox = { left: number; top: number; width: number; height: number; rotation: number; opacity: number; fill: string; radius: number };

export function previewBox(layer: AnimatedLayer, size: PreviewSize): PreviewBox {
  const width = layer.width * size.width;
  const height = layer.height * size.height;

  return {
    left: layer.x * size.width - width / 2,
    top: layer.y * size.height - height / 2,
    width,
    height,
    rotation: layer.rotation,
    opacity: layer.opacity,
    fill: layer.fill,
    radius: layer.radius * Math.min(width, height)
  };
}
