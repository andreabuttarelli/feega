import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION_LENGTH = 12;
const STATIC = 'static/gpu-core';
const TARGET = 'packages/motion-core/src/motion/gpu-full/core-version.ts';

export const BUILDS = { CORE_VERSION: 'gpu_core', CORE_GL_VERSION: 'gpu_core_gl' };

export const coreVersionOf = (...parts) => parts.reduce((hash, part) => hash.update(part), createHash('sha256')).digest('hex').slice(0, VERSION_LENGTH);

export const builtVersion = (name) => coreVersionOf(readFileSync(`${STATIC}/${name}_bg.wasm`), readFileSync(`${STATIC}/${name}.js`));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lines = Object.entries(BUILDS).map(([constant, name]) => `export const ${constant} = '${builtVersion(name)}';\n`);
  writeFileSync(TARGET, lines.join(''));
  console.log(lines.join('').trim());
}
