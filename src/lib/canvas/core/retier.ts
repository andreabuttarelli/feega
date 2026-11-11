import type { DisplayList } from '@feega/motion-core/motion/gpu-full/display-list';

type Node = { src?: string; items?: Node[] };

const swapped = (node: Node, swap: ReadonlyMap<string, string>): Node => {
  const src = node.src !== undefined ? swap.get(node.src) : undefined;
  const items = node.items?.map((i) => swapped(i, swap));
  return { ...node, ...(src ? { src } : {}), ...(items ? { items } : {}) };
};

export const retiered = (list: DisplayList, swap: ReadonlyMap<string, string>): DisplayList => swapped(list as unknown as Node, swap) as unknown as DisplayList;

const srcs = (node: Node): string[] => [...(node.src !== undefined ? [node.src] : []), ...(node.items ?? []).flatMap(srcs)];

export const retiers = (list: DisplayList, swap: ReadonlyMap<string, string>): boolean => srcs(list as unknown as Node).some((src) => swap.has(src));
