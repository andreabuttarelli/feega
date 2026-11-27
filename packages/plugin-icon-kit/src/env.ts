import type { ProjectInfo } from '@feega/plugin-api/protocol';
import type { Env } from './svg-component';

const FIRST_RUNES_MAJOR = 5;

export function envOf(info: ProjectInfo): Env {
  const major = Number(info.packages.svelte?.match(/\d+/)?.[0] ?? FIRST_RUNES_MAJOR);

  return { typescript: info.typescript, svelte5: major >= FIRST_RUNES_MAJOR };
}
