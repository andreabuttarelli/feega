import { createContext, type Snippet } from 'svelte';
import type { FrameMode } from './live-budget';
import type { CameraMotion } from './core/camera-motion';

export type TileRender = Snippet<[{ id: string; selected: boolean; live: FrameMode; motion: CameraMotion }]>;

export const [getTileRender, setTileRender] = createContext<() => TileRender>();
