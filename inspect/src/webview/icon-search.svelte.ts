import type { IconHit } from '../messages';

export const iconSearch = $state<{ id: number; library: string | null; hits: IconHit[]; error: string }>({ id: 0, library: null, hits: [], error: '' });
