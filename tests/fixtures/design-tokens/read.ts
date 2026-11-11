import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FIXTURES = join(process.cwd(), 'tests/fixtures/design-tokens');

export const fixturePath = (name: string) => join(FIXTURES, name);

export const fixture = (name: string) => (path: string) => readFile(join(FIXTURES, name, path), 'utf8').catch(() => null);
