import { FontSource, type FontFace } from './model';

export type LocalFile = { url: string; weight: number; italic: boolean };

const files = new Map<string, LocalFile[]>();

export function keepLocalFiles(family: string, list: LocalFile[]): void {
  files.set(family, list);
}

export function forgetLocalFiles(): void {
  files.clear();
}

export function localFaceCss(registry: readonly FontFace[]): string {
  return registry
    .filter((f) => f.source === FontSource.Local)
    .flatMap((f) => (files.get(f.family) ?? []).map((v) => `@font-face{font-family:'${f.family}';src:url(${JSON.stringify(v.url)});font-weight:${v.weight};font-style:${v.italic ? 'italic' : 'normal'};font-display:block}`))
    .join('');
}
