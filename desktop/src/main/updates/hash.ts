import { createHash, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';

export const sha512OfFile = (path: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha512');
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest()));
  });

const decodings = (expected: string): Buffer[] => [Buffer.from(expected, 'hex'), Buffer.from(expected, 'base64')];

export const matchesHash = (actual: Buffer, expected: string): boolean =>
  expected.length > 0 && decodings(expected).some((candidate) => candidate.length === actual.length && timingSafeEqual(candidate, actual));
