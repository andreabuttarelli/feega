import { createHash } from 'node:crypto';
import type { BrandTokens } from '@feega/motion-core/motion/brand';

const LOOK_LENGTH = 16;

export const lookOf = (tokens: BrandTokens): string => createHash('sha1').update(JSON.stringify(tokens)).digest('base64url').slice(0, LOOK_LENGTH);
