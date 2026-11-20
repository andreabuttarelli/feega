import type { Wiring } from '../messages';

export const wiringState = $state<{ at: string; instance?: number; wiring: Wiring | null }>({ at: '', wiring: null });
