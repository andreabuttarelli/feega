import { z } from 'zod';

export const MAX_VERSION_NAME = 60;

export type VersionNames = Record<string, string>;

export const versionNamesSchema = z.record(z.string().regex(/^\d+$/), z.string().min(1).max(MAX_VERSION_NAME));

export function namesOf(data: Record<string, unknown>): VersionNames {
  const raw = data.versionNames;
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && versionNamesSchema.safeParse({ [entry[0]]: entry[1] }).success));
}

export function withName(names: VersionNames, version: number, name: string): VersionNames {
  const key = String(version);
  const trimmed = name.trim().slice(0, MAX_VERSION_NAME);
  const { [key]: _old, ...rest } = names;
  return trimmed ? { ...rest, [key]: trimmed } : rest;
}
