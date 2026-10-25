import { readFileSync, writeFileSync } from 'node:fs';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';

const [docPath, out, ...frames] = process.argv.slice(2);
const verdict = parseMotionDoc(JSON.parse(readFileSync(docPath, 'utf8')));
if (!verdict.ok) {
  throw new Error(verdict.error);
}
const prepared = prepare(verdict.doc, FEEGA_TOKENS);
const wanted = frames.length ? frames.map(Number) : [0];
wanted.forEach((frame) => writeFileSync(wanted.length === 1 ? out : out.replace(/\.json$/, `-${frame}.json`), JSON.stringify(drawFrame(prepared, frame))));
