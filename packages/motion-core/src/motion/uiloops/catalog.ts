import type { SnapcnPort } from '../snapcn/model';

const PORT_FILES = import.meta.glob<SnapcnPort>(['./ports/*.ts', '!./ports/*.test.ts'], { eager: true, import: 'PORT' });

export const UI_LOOP_PORTS: readonly SnapcnPort[] = Object.values(PORT_FILES).sort((a, b) => a.id.localeCompare(b.id));
