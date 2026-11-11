import type { HfPort } from './model';

const PORT_FILES = import.meta.glob<HfPort>(['./ports/*.ts', '!./ports/*.test.ts'], { eager: true, import: 'PORT' });

export const HF_PORTS: readonly HfPort[] = Object.values(PORT_FILES).sort((a, b) => a.id.localeCompare(b.id));

export const hfPort = (id: string): HfPort | null => HF_PORTS.find((p) => p.id === id) ?? null;
