import { ItemKind, type DisplayList, type GroupItem } from '@feega/motion-core/motion/gpu-full/display-list';
import { BlendMode } from '@feega/motion-core/motion/blend';

type Shot = { width: number; height: number; scale: number };

export const shrunk = (list: DisplayList, shot: Shot): DisplayList => {
  const page: GroupItem = { kind: ItemKind.Group, clip: 'shot', items: list.items, opacity: 1, matrix: [shot.scale, 0, 0, shot.scale, 0, 0], blur: 0, blend: BlendMode.Normal };
  return { width: shot.width, height: shot.height, background: list.background, items: [page], unsupported: [] };
};
