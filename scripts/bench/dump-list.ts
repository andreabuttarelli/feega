import { readFileSync, writeFileSync } from 'node:fs';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { parseMotionDoc } from '$lib/motion/doc';
import { drawFrame, prepare } from '$lib/motion/gpu-full/display-list';

const [docPath, out, frameArg] = process.argv.slice(2);
const verdict = parseMotionDoc(JSON.parse(readFileSync(docPath, 'utf8')));
if (!verdict.ok) {
  throw new Error(verdict.error);
}
writeFileSync(out, JSON.stringify(drawFrame(prepare(verdict.doc, FEEGA_TOKENS), Number(frameArg ?? 0))));
