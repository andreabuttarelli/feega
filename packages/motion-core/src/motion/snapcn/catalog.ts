import type { SnapcnPort } from './model';

const PORT_FILES = import.meta.glob<SnapcnPort>(['./ports/*.ts', '!./ports/*.test.ts'], { eager: true, import: 'PORT' });

export const SNAPCN_PORTS: readonly SnapcnPort[] = Object.values(PORT_FILES).sort((a, b) => a.id.localeCompare(b.id));

export const snapcnPort = (id: string): SnapcnPort | null => SNAPCN_PORTS.find((p) => p.id === id) ?? null;
