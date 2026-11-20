import { DEFAULT_THEME, type Theme } from '@feega/live-edit/themes';

export const writtenTheme = (name: string): string | undefined => (name === DEFAULT_THEME ? undefined : name);

export const themeBadge = (name: string): string | null => (name === DEFAULT_THEME ? null : `theme: ${name}`);

export const stillThere = (names: string[], name: string): string => (names.includes(name) ? name : DEFAULT_THEME);

export const activeApply = (themes: Theme[], name: string) => themes.find((t) => t.name === name)?.apply ?? null;
