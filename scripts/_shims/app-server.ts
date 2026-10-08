import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function read(url: string): Response {
  return new Response(readFileSync(resolve(import.meta.dirname, '../..', `.${url}`)));
}
