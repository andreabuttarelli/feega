import { Mode } from '../messages';

export const MODE_KEYS: Record<Mode, string> = { [Mode.Design]: 'd', [Mode.Navigate]: 'n' };

export const modeOfKey = (key: string): Mode | null => (Object.entries(MODE_KEYS).find(([, k]) => k === key.toLowerCase())?.[0] as Mode | undefined) ?? null;
