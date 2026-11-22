import type { Manifest } from './manifest';

export enum Origin {
  Installed = 'installed',
  Dev = 'dev'
}

export type ExternalPlugin = { id: string; name: string; version: string; origin: Origin; enabled: boolean; words: string[]; manifest: Manifest; code: string };

export type Catalog = { plugins: ExternalPlugin[]; disabled: string[]; problems: string[] };
