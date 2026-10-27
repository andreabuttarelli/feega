export type FeedImageHover = { size: { w: number; h: number } | null; over: { x: number; y: number } | null };

export const feedImageHover = $state<FeedImageHover>({ size: null, over: null });
