import { createHash, randomBytes } from 'node:crypto';

const NONCE_BYTES = 32;

export const newNonce = (): string => randomBytes(NONCE_BYTES).toString('base64url');

export const hashNonce = (nonce: string): string => createHash('sha256').update(nonce).digest('hex');
