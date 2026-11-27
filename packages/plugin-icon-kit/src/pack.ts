import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

export const pack = (value: unknown): string => deflateRawSync(JSON.stringify(value), { level: 9 }).toString('base64');

export const installedVersion = (packageName: string): string => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../node_modules/${packageName}/package.json`, import.meta.url)), 'utf8')).version;

export const generatedSource = (version: string, data: unknown): string => `export const VERSION = '${version}';\nexport const PACKED = '${pack(data)}';\n`;
