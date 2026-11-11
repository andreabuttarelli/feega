import type { RendercompPort } from './model';

const PORT_FILES = import.meta.glob<RendercompPort>(['./ports/*.ts', '!./ports/*.test.ts'], { eager: true, import: 'PORT' });

export const RENDERCOMP_PORTS: readonly RendercompPort[] = Object.values(PORT_FILES).sort((a, b) => a.id.localeCompare(b.id));

export const rendercompPort = (id: string): RendercompPort | null => RENDERCOMP_PORTS.find((p) => p.id === id) ?? null;
