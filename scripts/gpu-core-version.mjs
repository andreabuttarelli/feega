import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION_LENGTH = 12;
const STATIC = 'static/gpu-core';
const TARGET = 'packages/motion-core/src/motion/gpu-full/core-version.ts';

export const coreVersionOf = (...parts) => parts.reduce((hash, part) => hash.update(part), createHash('sha256')).digest('hex').slice(0, VERSION_LENGTH);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = coreVersionOf(readFileSync(`${STATIC}/gpu_core_bg.wasm`), readFileSync(`${STATIC}/gpu_core.js`));
  writeFileSync(TARGET, `export const CORE_VERSION = '${version}';\n`);
  console.log(`gpu-core ${version}`);
}
