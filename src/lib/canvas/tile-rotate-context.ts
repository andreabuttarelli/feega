import { createContext } from 'svelte';

export type TileRotate = (id: string, degrees: number) => void;

export const [getTileRotate, setTileRotate] = createContext<() => TileRotate | undefined>();
