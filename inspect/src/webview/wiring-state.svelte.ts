import type { Wiring } from '../messages';

export const wiringState = $state<{ at: string; wiring: Wiring | null }>({ at: '', wiring: null });
