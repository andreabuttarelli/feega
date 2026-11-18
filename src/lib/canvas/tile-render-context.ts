import { createContext, type Snippet } from 'svelte';
import type { FrameMode } from './live-budget';

export type TileRender = Snippet<[{ id: string; selected: boolean; live: FrameMode }]>;

export const [getTileRender, setTileRender] = createContext<() => TileRender>();
