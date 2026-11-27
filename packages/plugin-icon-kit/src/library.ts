import type { Framework } from '@feega/plugin-api/protocol';
import type { ComponentSource, Env } from './svg-component';

export type Wrap = (iconName: string, componentName: string, env: Env) => ComponentSource;

export type Library = { framework: Framework; wrap: Wrap };

export const libraryIn = (libraries: Record<string, Library>, framework: Framework, packages: Record<string, string>): Library | null =>
  Object.entries(libraries).find(([name, library]) => library.framework === framework && name in packages)?.[1] ?? null;
