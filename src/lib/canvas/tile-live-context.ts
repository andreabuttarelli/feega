import { createContext } from 'svelte';
import type { LiveBox } from '$lib/realtime/canvas-presence';

export type TileLive = (boxes: LiveBox[]) => void;

export const [getTileLive, setTileLive] = createContext<() => TileLive | undefined>();
