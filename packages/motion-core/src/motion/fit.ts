import type { Box } from './layout';

export const SAFE_INSET = 0.05;
type Area = { width: number; height: number };

export function safeBox(box: Box, frame: Area): Box {
  const minX = frame.width * SAFE_INSET;
  const maxX = frame.width * (1 - SAFE_INSET);
  const minY = frame.height * SAFE_INSET;
  const maxY = frame.height * (1 - SAFE_INSET);
  const left = Math.max(minX, box.left);
  const top = Math.max(minY, box.top);
  return { left, top, width: Math.min(maxX, box.left + box.width) - left, height: Math.min(maxY, box.top + box.height) - top };
}
