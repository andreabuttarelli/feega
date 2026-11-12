import type { SnapcnPort } from '../snapcn/model';

export enum RendercompCategory {
  Logo = 'logos',
  Text = 'text',
  Transition = 'transitions',
  Chart = 'charts',
  Social = 'social',
  Loop = 'loops'
}

export type RendercompPort = Omit<SnapcnPort, 'category'> & { category: RendercompCategory };

export const RENDERCOMP_NAME_PREFIX = 'Rendercomp';

export const rendercompName = (id: string) => `${RENDERCOMP_NAME_PREFIX}${id.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())}`;
