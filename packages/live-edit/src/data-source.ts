import type { LiveAt } from './class-patch';
import type { ReadFile } from './files';

const FIRST_NAME = /^\{\s*(?:[#:@][a-z]+\s+)?([A-Za-z_$][\w$]*)/;
const MODULE_EXTENSIONS = ['', '.ts', '.js', '.svelte.ts', '.svelte.js', '/index.ts', '/index.js'];

const declaration = (name: string) => new RegExp(`\\b(?:const|let|var|function)\\s+(${name})\\b`);
const importOf = (name: string) => new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"](\\.{1,2}/[^'"]+)['"]`);

export const dirOf = (file: string) => file.slice(0, file.lastIndexOf('/') + 1);
const nameOf = (file: string) => file.slice(file.lastIndexOf('/') + 1);

export function joined(dir: string, relative: string): string {
  const parts = dir.split('/').filter(Boolean);
  for (const piece of relative.split('/')) {
    if (piece === '..') {
      parts.pop();
      continue;
    }
    if (piece !== '.') {
      parts.push(piece);
    }
  }
  return parts.join('/');
}

export function declaredIn(text: string, file: string, name: string): LiveAt | null {
  const found = declaration(name).exec(text);
  if (!found) {
    return null;
  }
  const offset = found.index + found[0].length - name.length;
  const lines = text.slice(0, offset).split('\n');
  return { file, line: lines.length, col: lines[lines.length - 1].length + 1 };
}

async function importedFrom(read: ReadFile, file: string, text: string, name: string): Promise<LiveAt | null> {
  const from = text.match(importOf(name));
  if (!from) {
    return null;
  }
  const base = joined(dirOf(file), from[1]);
  for (const extension of MODULE_EXTENSIONS) {
    const target = base + extension;
    const body = await read(target);
    if (body !== null) {
      return declaredIn(body, target, name);
    }
  }
  return null;
}

export type DataSource = { name: string; at: LiveAt };

export async function dataSource(read: ReadFile, file: string, text: string, expression: string): Promise<DataSource | null> {
  const name = expression.match(FIRST_NAME)?.[1];
  if (!name) {
    return null;
  }
  const at = declaredIn(text, file, name) ?? (await importedFrom(read, file, text, name));
  return at ? { name, at } : null;
}

export const dataReason = (data: DataSource) => `This text comes from data: \`${data.name}\` (${nameOf(data.at.file)}:${data.at.line}).`;
