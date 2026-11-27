import { deflateRawSync } from 'node:zlib';

export const pack = (value: unknown): string => deflateRawSync(JSON.stringify(value), { level: 9 }).toString('base64');
