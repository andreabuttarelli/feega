import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CODE_TARGETS, exportCode } from '@feega/motion-core/motion/codegen/index';
import { toyGlb } from '@feega/motion-core/motion/codegen/fixtures/glb';
import { MODEL_ASSET, showcaseDoc } from '@feega/motion-core/motion/codegen/fixtures/scene3d';

const [out] = process.argv.slice(2);

for (const target of CODE_TARGETS) {
  const code = exportCode(showcaseDoc(), { target, name: 'Toy', assets: { [MODEL_ASSET]: 'https://assets.invalid/toy.glb' } });
  const files = [...code.files.map((f) => ({ path: f.path, bytes: Buffer.from(f.content) })), ...code.assets.map((a) => ({ path: a.path, bytes: Buffer.from(toyGlb()) }))];
  for (const file of files) {
    const path = join(out, target, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.bytes);
  }
}
