import type { LayerNode } from '../messages';

const stamped = (node: LayerNode): boolean => node.source !== null || node.children.some(stamped);

export const hasSourceInfo = (layers: LayerNode[]): boolean => layers.length === 0 || layers.some(stamped);
