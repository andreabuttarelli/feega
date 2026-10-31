import { holdsDoc } from '$lib/canvas/motion-node';

export const docNodeIds = (nodes: readonly { id: string; type: string }[]): string[] => nodes.filter((n) => holdsDoc(n.type)).map((n) => n.id);
