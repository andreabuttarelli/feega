type Box = { x: number; y: number; w: number; h: number };

export type ResizeGesture = { nodeId: string; before: Box; after: Box };

export const inverseResize = (gesture: ResizeGesture): ResizeGesture => ({ nodeId: gesture.nodeId, before: gesture.after, after: gesture.before });

export const resizeStale = (gesture: ResizeGesture, current: { x: number; y: number } | null): boolean => !current || current.x !== gesture.after.x || current.y !== gesture.after.y;

export const sameBox = (a: Box, b: Box): boolean => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
