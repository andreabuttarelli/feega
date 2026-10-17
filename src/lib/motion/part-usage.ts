import TABLE from './template/part-usage.json';
import { parsePart } from './poster-parts';

export const PAGE = '@page';

export type PartUsage = { parts: Record<string, number>; fields: Record<string, string[]> };

export enum Reach {
  Own = 'own',
  Shared = 'shared',
  Elsewhere = 'elsewhere'
}

const USAGE: Record<string, PartUsage> = TABLE;

export const partUsage = (component: string): PartUsage | null => USAGE[component] ?? null;

const instancesOf = (usage: PartUsage, field: string) => usage.parts[field] ?? 1;

export function sharedCount(usage: PartUsage, key: string, part: string): number {
  const { field } = parsePart(part);
  const users = usage.fields[key] ?? [];
  return users.filter((u) => u !== PAGE).reduce((n, u) => n + instancesOf(usage, u), 0) - (users.includes(field) ? 1 : 0);
}

export function reach(usage: PartUsage, key: string, part: string): Reach {
  const { field } = parsePart(part);
  const users = usage.fields[key] ?? [];
  if (!users.includes(field)) {
    return Reach.Elsewhere;
  }
  return users.length === 1 && instancesOf(usage, field) === 1 ? Reach.Own : Reach.Shared;
}
